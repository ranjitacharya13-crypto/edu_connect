package com.educonnect.edustaff;

import android.app.DatePickerDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.splashscreen.SplashScreen;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.google.android.material.switchmaterial.SwitchMaterial;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class NativeMainActivity extends AppCompatActivity {
    private static final int PAGE_CONTACTS = 1;
    private static final int PAGE_CALLS = 2;
    private static final int PAGE_UPLOAD = 3;
    private static final int PAGE_SETTINGS = 4;
    private static final int PICK_CSV = 31;
    private static final int SAVE_CSV = 32;
    private static final int MAX_CSV_BYTES = 10 * 1024 * 1024;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final LinkedHashSet<String> selectedContacts = new LinkedHashSet<>();
    private final HashSet<String> callsInFlight = new HashSet<>();
    private SecureSession session;
    private NativeApi api;
    private JSONObject user;
    private LinearLayout page;
    private LinearLayout content;
    private ProgressBar progress;
    private BottomNavigationView navigation;
    private String currentPage = "Contacts";
    private String searchText = "";
    private int contactPage = 1;
    private int contactPages = 1;
    private String admissionFilter = "";
    private String departmentFilter = "";
    private String statusFilter = "";
    private Uri pendingCsv;
    private boolean teacherCsvMode;
    private JSONArray customFields = new JSONArray();
    private JSONArray teachers = new JSONArray();
    private byte[] pendingExport;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(getPreferences(MODE_PRIVATE).getBoolean("dark_mode", false)
            ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO);
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        session = new SecureSession(this);
        api = new NativeApi(BuildConfig.API_BASE_URL, session);
        showLoading("Checking account...");
        String token = session.readToken();
        if (token == null) showAuth(false);
        else apiCall(() -> api.get("/auth/me"), account -> {
            user = account;
            showDashboard();
        }, message -> {
            session.clear();
            showAuth(false);
        });
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (user != null && navigation != null && !"Contacts".equals(currentPage)) {
            navigation.setSelectedItemId(PAGE_CONTACTS);
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        if (requestCode == PICK_CSV) {
            pendingCsv = data.getData();
            previewCsv(pendingCsv);
        } else if (requestCode == SAVE_CSV && pendingExport != null) {
            Uri destination = data.getData();
            byte[] bytes = pendingExport;
            pendingExport = null;
            executor.execute(() -> {
                try (java.io.OutputStream output = getContentResolver().openOutputStream(destination)) {
                    if (output == null) throw new java.io.IOException("Could not open the selected location.");
                    output.write(bytes);
                    mainHandler.post(() -> toast("CSV exported"));
                } catch (Exception error) {
                    mainHandler.post(() -> toast(error.getMessage()));
                }
            });
        }
    }

    private void apiCall(ApiCall<JSONObject> request, ResultHandler<JSONObject> success, ResultHandler<String> failure) {
        apiCallGeneric(request, success, failure);
    }

    private <T> void apiCallGeneric(ApiCall<T> request, ResultHandler<T> success, ResultHandler<String> failure) {
        executor.execute(() -> {
            try {
                T result = request.run();
                mainHandler.post(() -> success.accept(result));
            } catch (Exception error) {
                if (error instanceof NativeApi.ApiException && ((NativeApi.ApiException) error).statusCode == 401
                    && session.readToken() != null) {
                    session.clear();
                    callsInFlight.clear();
                    mainHandler.post(() -> showAuth(false));
                } else {
                    String message = error.getMessage() == null ? "Request failed." : error.getMessage();
                    mainHandler.post(() -> failure.accept(message));
                }
            }
        });
    }

    private interface ApiCall<T> {
        T run() throws Exception;
    }

    private interface ResultHandler<T> {
        void accept(T value);
    }

    private void showLoading(String message) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));
        TextView label = text(message, 16, 0xff455468, true);
        ProgressBar spinner = new ProgressBar(this);
        root.addView(spinner);
        root.addView(label, marginParams(-2, -2, 0, 16, 0, 0));
        setContentView(root);
    }

    private void showAuth(boolean signup) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(0xfff5f7fa);
        root.setPadding(dp(24), dp(40), dp(24), dp(24));
        ScrollView scroll = new ScrollView(this);
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        TextView brand = text("EduStaff", 30, 0xff162a42, true);
        form.addView(brand, marginParams(-1, -2, 0, 0, 0, 4));
        form.addView(text(signup ? "Create your teacher account" : "Sign in to your workspace", 15, 0xff607087, false), marginParams(-1, -2, 0, 0, 0, 22));

        EditText name = signup ? addInput(form, "Full name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, false) : null;
        EditText birthDate = signup ? addInput(form, "Date of birth", InputType.TYPE_CLASS_DATETIME, false) : null;
        if (birthDate != null) {
            birthDate.setFocusable(false);
            birthDate.setOnClickListener(view -> chooseDate(birthDate));
        }
        EditText phone = signup ? addInput(form, "Phone", InputType.TYPE_CLASS_PHONE, false) : null;
        EditText email = addInput(form, "Email", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, false);
        EditText password = addInput(form, "Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
        MaterialButton submit = button(signup ? "Create teacher account" : "Sign in", true);
        form.addView(submit, marginParams(-1, dp(52), 0, 16, 0, 0));
        TextView toggle = text(signup ? "Already have an account? Sign in" : "New teacher? Create an account", 14, 0xff1559a8, true);
        toggle.setGravity(Gravity.CENTER);
        toggle.setPadding(0, dp(18), 0, dp(18));
        form.addView(toggle);
        toggle.setOnClickListener(view -> showAuth(!signup));
        scroll.addView(form);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
        setContentView(root);
        submit.setOnClickListener(view -> {
            String emailValue = value(email).trim();
            String passwordValue = value(password);
            if (emailValue.isEmpty() || passwordValue.isEmpty()) {
                toast("Email and password are required");
                return;
            }
            if (signup && (value(name).trim().isEmpty() || value(phone).trim().isEmpty() || value(birthDate).isEmpty())) {
                toast("Name, date of birth, and phone are required");
                return;
            }
            JSONObject body = new JSONObject();
            try {
                body.put("email", emailValue);
                body.put("password", passwordValue);
                if (signup) {
                    body.put("name", value(name).trim());
                    body.put("dateOfBirth", value(birthDate));
                    body.put("phone", value(phone).trim());
                }
            } catch (JSONException error) {
                toast("Could not prepare account request");
                return;
            }
            submit.setEnabled(false);
            apiCall(() -> api.post(signup ? "/auth/signup" : "/auth/login", body), result -> {
                try {
                    session.saveToken(result.getString("token"));
                    user = result.getJSONObject("user");
                    showDashboard();
                } catch (Exception error) {
                    toast("Could not save your secure session");
                    submit.setEnabled(true);
                }
            }, message -> {
                submit.setEnabled(true);
                toast(message);
            });
        });
    }

    private void chooseDate(EditText target) {
        Calendar today = Calendar.getInstance();
        DatePickerDialog dialog = new DatePickerDialog(this, (picker, year, month, day) ->
                target.setText(String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day)),
                today.get(Calendar.YEAR) - 25, today.get(Calendar.MONTH), today.get(Calendar.DAY_OF_MONTH));
        dialog.getDatePicker().setMaxDate(System.currentTimeMillis());
        dialog.show();
    }

    private void showDashboard() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xfff5f7fa);
        MaterialToolbar toolbar = new MaterialToolbar(this);
        toolbar.setTitle("EduStaff");
        toolbar.setTitleTextColor(0xff162a42);
        toolbar.setBackgroundColor(0xfff5f7fa);
        toolbar.setElevation(dp(1));
        toolbar.inflateMenu(0);
        toolbar.setNavigationIcon(android.R.drawable.ic_menu_myplaces);
        toolbar.setNavigationOnClickListener(view -> showAccount());
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(58)));
        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(16), dp(16), dp(20));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        navigation = new BottomNavigationView(this);
        navigation.setBackgroundColor(Color.WHITE);
        navigation.getMenu().add(0, PAGE_CONTACTS, 0, "Students").setIcon(android.R.drawable.ic_menu_agenda);
        navigation.getMenu().add(0, PAGE_CALLS, 1, "Calls").setIcon(android.R.drawable.ic_menu_call);
        if (hasPermission("canUploadStudents")) navigation.getMenu().add(0, PAGE_UPLOAD, 2, "Add").setIcon(android.R.drawable.ic_menu_add);
        navigation.getMenu().add(0, PAGE_SETTINGS, 3, "Settings").setIcon(android.R.drawable.ic_menu_manage);
        navigation.setOnItemSelectedListener(item -> {
            if (item.getItemId() == PAGE_CONTACTS) showContacts();
            else if (item.getItemId() == PAGE_CALLS) showCalls();
            else if (item.getItemId() == PAGE_UPLOAD) showUpload();
            else showSettings();
            return true;
        });
        root.addView(navigation, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
        apiCallGeneric(() -> api.getArray("/custom-fields"), fields -> customFields = fields, this::toast);
        if ("Calls".equals(currentPage)) navigation.setSelectedItemId(PAGE_CALLS);
        else if ("Settings".equals(currentPage)) navigation.setSelectedItemId(PAGE_SETTINGS);
        else if ("Add".equals(currentPage)) navigation.setSelectedItemId(PAGE_UPLOAD);
        else navigation.setSelectedItemId(PAGE_CONTACTS);
    }

    private void showContacts() {
        currentPage = "Contacts";
        if (content == null) return;
        content.removeAllViews();
        pageHeading("Students", "Search and manage your student contacts.");
        EditText search = addInput(content, "Search students", InputType.TYPE_CLASS_TEXT, false);
        search.setText(searchText);
        MaterialButton filterButton = button("Filters", false);
        content.addView(filterButton, marginParams(-1, dp(48), 0, 8, 0, 0));
        filterButton.setOnClickListener(view -> showFilters());
        if (hasPermission("canUploadStudents")) {
            MaterialButton add = button("Add student", true);
            content.addView(add, marginParams(-1, dp(48), 0, 8, 0, 0));
            add.setOnClickListener(view -> showManualStudentForm());
        }
        if (!selectedContacts.isEmpty()) {
            content.addView(text(selectedContacts.size() + " students selected", 14, 0xff1559a8, true), marginParams(-1, -2, 0, 10, 0, 0));
            MaterialButton exportSelected = button("Export selected", false);
            content.addView(exportSelected, marginParams(-1, dp(46), 0, 6, 0, 0));
            exportSelected.setOnClickListener(view -> exportContacts(selectedContacts));
            if ("admin".equals(user.optString("role"))) {
                MaterialButton assignSelected = button("Assign selected to teacher", false);
                content.addView(assignSelected, marginParams(-1, dp(46), 0, 6, 0, 0));
                assignSelected.setOnClickListener(view -> showBulkAssignment());
            }
            MaterialButton clearSelected = button("Clear selection", false);
            content.addView(clearSelected, marginParams(-1, dp(42), 0, 6, 0, 0));
            clearSelected.setOnClickListener(view -> { selectedContacts.clear(); showContacts(); });
        }
        LinearLayout results = new LinearLayout(this);
        results.setOrientation(LinearLayout.VERTICAL);
        content.addView(results, marginParams(-1, -2, 0, 12, 0, 0));
        search.setOnEditorActionListener((view, action, event) -> {
            searchText = value(search).trim();
            loadContacts(results);
            ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(search.getWindowToken(), 0);
            return true;
        });
        loadContacts(results);
    }

    private void loadContacts(LinearLayout results) {
        results.removeAllViews();
        addProgress(results, "Loading students...");
        StringBuilder path = new StringBuilder("/contacts?page=").append(contactPage).append("&pageSize=20");
        if (!searchText.isEmpty()) path.append("&search=").append(NativeApi.encode(searchText));
        if (!admissionFilter.isEmpty()) path.append("&admissionType=").append(NativeApi.encode(admissionFilter));
        if (!departmentFilter.isEmpty()) path.append("&department=").append(NativeApi.encode(departmentFilter));
        if (!statusFilter.isEmpty()) path.append("&status=").append(NativeApi.encode(statusFilter));
        apiCall(() -> api.get(path.toString()), response -> {
            results.removeAllViews();
            contactPages = Math.max(1, response.optInt("totalPages", 1));
            JSONArray contacts = response.optJSONArray("contacts");
            if (contacts == null || contacts.length() == 0) {
                results.addView(emptyState("No students found", "Try changing your search or filters."));
                return;
            }
            for (int index = 0; index < contacts.length(); index++) {
                JSONObject contact = contacts.optJSONObject(index);
                if (contact != null) results.addView(contactCard(contact), marginParams(-1, -2, 0, 0, 0, 12));
            }
            LinearLayout pages = new LinearLayout(this);
            pages.setGravity(Gravity.CENTER_VERTICAL);
            MaterialButton previous = button("Previous", false);
            MaterialButton next = button("Next", false);
            TextView pageLabel = text("Page " + contactPage + " of " + contactPages, 13, 0xff607087, true);
            pages.addView(previous, new LinearLayout.LayoutParams(0, dp(44), 1));
            pages.addView(pageLabel, marginParams(-2, -2, 10, 0, 10, 0));
            pages.addView(next, new LinearLayout.LayoutParams(0, dp(44), 1));
            results.addView(pages, marginParams(-1, -2, 0, 8, 0, 0));
            previous.setEnabled(contactPage > 1);
            next.setEnabled(contactPage < contactPages);
            previous.setOnClickListener(view -> { if (contactPage > 1) { contactPage--; showContacts(); } });
            next.setOnClickListener(view -> { if (contactPage < contactPages) { contactPage++; showContacts(); } });
        }, message -> showError(results, message, this::showContacts));
    }

    private View contactCard(JSONObject contact) {
        MaterialCardView card = card();
        LinearLayout column = vertical();
        String name = studentName(contact);
        CheckBox selection = new CheckBox(this);
        selection.setText("Select student");
        selection.setTextSize(12);
        selection.setChecked(selectedContacts.contains(contact.optString("_id")));
        column.addView(selection);
        selection.setOnCheckedChangeListener((button, checked) -> {
            if (checked) selectedContacts.add(contact.optString("_id"));
            else selectedContacts.remove(contact.optString("_id"));
            showContacts();
        });
        column.addView(text(name, 18, 0xff162a42, true));
        column.addView(text(contact.optString("phone", "No guardian phone"), 14, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 0));
        JSONObject student = contact.optJSONObject("student");
        if (student != null) {
            String summary = join(student.optString("admissionType", ""), student.optString("department", ""));
            if (!summary.isEmpty()) column.addView(text(summary, 13, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 0));
        }
        JSONObject values = contact.optJSONObject("customFields");
        if (values != null) for (int index = 0; index < customFields.length(); index++) {
            JSONObject field = customFields.optJSONObject(index);
            if (field == null || !field.optBoolean("tableVisible", true) || !"active".equals(field.optString("state", "active"))) continue;
            Object value = values.opt(field.optString("key"));
            if (value == null || value == JSONObject.NULL) continue;
            column.addView(text(field.optString("label") + ": " + value, 12, 0xff607087, false), marginParams(-1, -2, 0, 3, 0, 0));
        }
        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.END);
        MaterialButton details = button("Details", false);
        MaterialButton edit = button("Edit", false);
        MaterialButton call = button("Call", true);
        actions.addView(details, new LinearLayout.LayoutParams(0, dp(44), 1));
        actions.addView(edit, marginParams(0, dp(44), 4, 0, 0, 0, 1));
        actions.addView(call, marginParams(0, dp(44), 4, 0, 0, 0, 1));
        column.addView(actions, marginParams(-1, -2, 0, 12, 0, 0));
        details.setOnClickListener(view -> showContactDetails(contact));
        edit.setVisibility(hasPermission("canEditContacts") ? View.VISIBLE : View.GONE);
        edit.setOnClickListener(view -> editContact(contact));
        call.setOnClickListener(view -> startCall(contact));
        if (hasPermission("canDeleteContacts")) {
            MaterialButton delete = button("Delete", false);
            delete.setTextColor(0xffb3261e);
            column.addView(delete, marginParams(-1, dp(42), 0, 6, 0, 0));
            delete.setOnClickListener(view -> new AlertDialog.Builder(this).setTitle("Delete student?")
                    .setMessage("This permanently deletes " + name + ".")
                    .setNegativeButton("Cancel", null).setPositiveButton("Delete", (dialog, which) ->
                            apiCall(() -> { api.delete("/contacts/" + contact.optString("_id")); return new JSONObject(); }, result -> showContacts(), this::toast)).show());
        }
        card.addView(column);
        return card;
    }

    private void showFilters() {
        LinearLayout form = vertical();
        Spinner admission = spinner(new String[]{"Any admission type", "Regular", "Lateral Entry", "Part Time"});
        Spinner department = spinner(new String[]{"Any department", "CSE", "Civil", "AI/ML", "Mech", "ECE", "EEE", "Automobile"});
        form.addView(admission, marginParams(-1, dp(52), 0, 0, 0, 8));
        form.addView(department, marginParams(-1, dp(52), 0, 0, 0, 8));
        Spinner status = null;
        if ("admin".equals(user.optString("role"))) {
            status = spinner(new String[]{"Any status", "Primary Guardian", "Medical Alert", "New Admission", "Absent Today", "Inquiry"});
            form.addView(status, marginParams(-1, dp(52), 0, 0, 0, 0));
        }
        setSpinner(admission, new String[]{"", "Regular", "Lateral Entry", "Part Time"}, admissionFilter);
        setSpinner(department, new String[]{"", "CSE", "Civil", "AI/ML", "Mech", "ECE", "EEE", "Automobile"}, departmentFilter);
        if (status != null) setSpinner(status, new String[]{"", "Primary Guardian", "Medical Alert", "New Admission", "Absent Today", "Inquiry"}, statusFilter);
        Spinner statusFilterSpinner = status;
        new AlertDialog.Builder(this).setTitle("Filter students").setView(form)
                .setNeutralButton("Clear", (dialog, which) -> { admissionFilter = ""; departmentFilter = ""; statusFilter = ""; showContacts(); })
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Apply", (dialog, which) -> {
                    admissionFilter = admission.getSelectedItemPosition() == 0 ? "" : (String) admission.getSelectedItem();
                    contactPage = 1;
                    departmentFilter = department.getSelectedItemPosition() == 0 ? "" : (String) department.getSelectedItem();
                    statusFilter = statusFilterSpinner == null || statusFilterSpinner.getSelectedItemPosition() == 0 ? "" : (String) statusFilterSpinner.getSelectedItem();
                    showContacts();
                }).show();
    }

    private void showContactDetails(JSONObject contact) {
        String id = contact.optString("_id");
        LinearLayout detail = vertical();
        detail.setPadding(dp(18), dp(10), dp(18), dp(10));
        detail.addView(text("Guardian phone", 12, 0xff607087, true));
        detail.addView(text(contact.optString("phone", "Not provided"), 16, 0xff162a42, false));
        JSONObject student = contact.optJSONObject("student");
        if (student != null) {
            detail.addView(text("Admission type", 12, 0xff607087, true), marginParams(-1, -2, 0, 14, 0, 0));
            detail.addView(text(student.optString("admissionType", "Not provided"), 16, 0xff162a42, false));
            detail.addView(text("Department", 12, 0xff607087, true), marginParams(-1, -2, 0, 14, 0, 0));
            detail.addView(text(student.optString("department", "Not provided"), 16, 0xff162a42, false));
        }
        JSONObject assigned = contact.optJSONObject("assignedTo");
        detail.addView(text("Assigned teacher", 12, 0xff607087, true), marginParams(-1, -2, 0, 14, 0, 0));
        detail.addView(text(assigned == null ? "Unassigned" : assigned.optString("name", "Unassigned"), 16, 0xff162a42, false));
        MaterialButton noteButton = button("Add a communication note", false);
        detail.addView(noteButton, marginParams(-1, dp(46), 0, 16, 0, 0));
        noteButton.setOnClickListener(view -> showNoteDialog(id, false, null));
        MaterialButton smsButton = button("Send SMS through configured provider", false);
        detail.addView(smsButton, marginParams(-1, dp(46), 0, 8, 0, 0));
        smsButton.setOnClickListener(view -> showSmsDialog(contact));
        MaterialButton smsComposer = button("Open messaging app", false);
        detail.addView(smsComposer, marginParams(-1, dp(46), 0, 8, 0, 0));
        smsComposer.setOnClickListener(view -> openSmsComposer(contact));
        if ("admin".equals(user.optString("role"))) {
            MaterialButton assign = button("Assign teacher", false);
            detail.addView(assign, marginParams(-1, dp(46), 0, 8, 0, 0));
            assign.setOnClickListener(view -> showAssignmentDialog(contact));
        }
        new AlertDialog.Builder(this).setTitle(studentName(contact)).setView(detail).setPositiveButton("Close", null).show();
        apiCallGeneric(() -> api.getArray("/communications/contact/" + id), records -> {
            if (records.length() == 0) return;
            StringBuilder history = new StringBuilder("Recent communication\n");
            for (int index = 0; index < Math.min(records.length(), 5); index++) {
                JSONObject record = records.optJSONObject(index);
                if (record == null) continue;
                history.append("\n• ").append(record.optString("kind", "activity")).append(": ")
                        .append(record.optString("summary", record.optString("status", record.optString("outcome", ""))));
            }
            new AlertDialog.Builder(this).setTitle("Communication history").setMessage(history.toString()).setPositiveButton("Close", null).show();
        }, this::toast);
    }

    private void showNoteDialog(String id, boolean forCall, String callName) {
        EditText input = addInput(null, "Note", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, false);
        new AlertDialog.Builder(this).setTitle("Add note").setView(input).setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    String note = value(input).trim();
                    if (note.isEmpty()) { toast("Note text is required"); return; }
                    JSONObject body = new JSONObject();
                    try { body.put("summary", note); } catch (JSONException ignored) { }
                    String path = forCall ? "/calls/" + id + "/notes" : "/activities";
                    if (!forCall) try { body.put("contactId", id); body.put("type", "note"); } catch (JSONException ignored) { }
                    apiCall(() -> api.post(path, body), result -> toast("Note saved"), this::toast);
                }).show();
    }

    private void showSmsDialog(JSONObject contact) {
        EditText message = addInput(null, "Message", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, false);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Send SMS").setView(message).setNegativeButton("Cancel", null)
                .setPositiveButton("Send", null).create();
        dialog.setOnShowListener(dialogState -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
                    String text = value(message).trim();
                    if (text.isEmpty()) { toast("Message is required"); return; }
                    JSONObject body = new JSONObject();
                    try { body.put("contactId", contact.optString("_id")); body.put("message", text); body.put("idempotencyKey", UUID.randomUUID().toString()); }
                    catch (JSONException ignored) { }
                    Button send = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
                    send.setEnabled(false);
                    apiCall(() -> api.post("/communications/sms", body), result -> {
                        toast("Message " + result.optString("status", "queued"));
                        dialog.dismiss();
                    }, error -> { send.setEnabled(true); toast(error); });
                }));
        dialog.show();
    }

    private void openSmsComposer(JSONObject contact) {
        String number = contact.optString("phone", "").replaceAll("[\\s().-]", "");
        if (!number.matches("\\+?[1-9]\\d{7,14}")) {
            toast("A valid guardian phone number is required");
            return;
        }
        Intent compose = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)));
        if (compose.resolveActivity(getPackageManager()) != null) startActivity(compose);
        else toast("No compatible messaging app could be opened");
    }

    private void showAssignmentDialog(JSONObject contact) {
        apiCallGeneric(() -> api.getArray("/admin/teachers"), loaded -> {
            teachers = loaded;
            ArrayList<String> names = new ArrayList<>();
            ArrayList<String> ids = new ArrayList<>();
            names.add("Unassigned");
            ids.add("");
            for (int index = 0; index < teachers.length(); index++) {
                JSONObject teacher = teachers.optJSONObject(index);
                if (teacher == null) continue;
                names.add(teacher.optString("name", "Teacher"));
                ids.add(teacher.optString("id", ""));
            }
            Spinner picker = spinner(names.toArray(new String[0]));
            JSONObject assigned = contact.optJSONObject("assignedTo");
            String currentId = assigned == null ? contact.optString("assignedTo", "") : assigned.optString("_id", "");
            for (int index = 0; index < ids.size(); index++) if (ids.get(index).equals(currentId)) picker.setSelection(index);
            new AlertDialog.Builder(this).setTitle("Assign student").setView(picker)
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Save", (dialog, which) -> {
                        JSONObject body = new JSONObject();
                        try { body.put("teacherId", ids.get(picker.getSelectedItemPosition())); }
                        catch (JSONException ignored) { }
                        apiCall(() -> api.patch("/admin/contacts/" + contact.optString("_id") + "/assignment", body),
                                result -> { toast("Assignment updated"); showContacts(); }, this::toast);
                    }).show();
        }, this::toast);
    }

    private void showBulkAssignment() {
        apiCallGeneric(() -> api.getArray("/admin/teachers"), loaded -> {
            teachers = loaded;
            ArrayList<String> names = new ArrayList<>();
            ArrayList<String> ids = new ArrayList<>();
            names.add("Unassigned");
            ids.add("");
            for (int index = 0; index < teachers.length(); index++) {
                JSONObject teacher = teachers.optJSONObject(index);
                if (teacher == null) continue;
                names.add(teacher.optString("name", "Teacher"));
                ids.add(teacher.optString("id", ""));
            }
            Spinner picker = spinner(names.toArray(new String[0]));
            new AlertDialog.Builder(this).setTitle("Assign " + selectedContacts.size() + " students")
                    .setView(picker).setNegativeButton("Cancel", null)
                    .setPositiveButton("Assign", (dialog, which) -> {
                        JSONObject body = new JSONObject();
                        JSONArray idsArray = new JSONArray();
                        for (String id : selectedContacts) idsArray.put(id);
                        try { body.put("contactIds", idsArray); body.put("teacherId", ids.get(picker.getSelectedItemPosition())); }
                        catch (JSONException ignored) { }
                        apiCall(() -> api.patch("/admin/contacts/bulk-assignment", body), result -> {
                            selectedContacts.clear();
                            toast("Students assigned");
                            showContacts();
                        }, this::toast);
                    }).show();
        }, this::toast);
    }

    private void editContact(JSONObject contact) {
        JSONObject student = contact.optJSONObject("student");
        LinearLayout form = vertical();
        form.setPadding(dp(20), dp(4), dp(20), dp(4));
        EditText name = addInput(form, "Student name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, false);
        name.setText(student == null ? contact.optString("name") : student.optString("name", contact.optString("name")));
        EditText phone = addInput(form, "Parent/guardian phone", InputType.TYPE_CLASS_PHONE, false);
        phone.setText(contact.optString("phone"));
        Spinner admission = spinner(new String[]{"Regular", "Lateral Entry", "Part Time"});
        form.addView(admission, marginParams(-1, dp(50), 0, 0, 0, 6));
        setSpinner(admission, new String[]{"Regular", "Lateral Entry", "Part Time"}, student == null ? "" : student.optString("admissionType"));
        Spinner department = spinner(new String[]{"CSE", "Civil", "AI/ML", "Mech", "ECE", "EEE", "Automobile"});
        form.addView(department, marginParams(-1, dp(50), 0, 0, 0, 6));
        String currentAdmission = student == null ? "" : student.optString("admissionType");
        updateDepartmentOptions(department, currentAdmission, student == null ? "" : student.optString("department"));
        EditText notes = null;
        if (hasPermission("canDeleteContacts")) {
            notes = addInput(form, "Notes", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, false);
            notes.setText(contact.optString("notes"));
        }
        Spinner status = null;
        if (hasPermission("canDeleteContacts")) {
            status = spinner(new String[]{"Primary Guardian", "Medical Alert", "New Admission", "Absent Today", "Inquiry"});
            form.addView(status, marginParams(-1, dp(50), 0, 0, 0, 6));
            setSpinner(status, new String[]{"Primary Guardian", "Medical Alert", "New Admission", "Absent Today", "Inquiry"}, contact.optString("status"));
        }
        final Spinner statusField = status;
        final EditText notesField = notes;
        admission.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                updateDepartmentOptions(department, (String) admission.getSelectedItem(), student == null ? "" : student.optString("department"));
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        new AlertDialog.Builder(this).setTitle("Edit student").setView(form).setNegativeButton("Cancel", null)
                .setPositiveButton("Save", (dialog, which) -> {
                    JSONObject body = new JSONObject();
                    JSONObject studentUpdate = new JSONObject();
                    try {
                        studentUpdate.put("name", value(name).trim());
                        studentUpdate.put("admissionType", admission.getSelectedItem());
                        studentUpdate.put("department", department.getSelectedItem());
                        if (student != null) studentUpdate.put("grade", student.optString("grade", ""));
                        body.put("name", value(name).trim());
                        body.put("student", studentUpdate);
                        body.put("phone", value(phone).trim());
                        if (notesField != null) body.put("notes", value(notesField).trim());
                        if (statusField != null) body.put("status", statusField.getSelectedItem());
                    } catch (JSONException ignored) { }
                    apiCall(() -> api.patch("/contacts/" + contact.optString("_id"), body), result -> {
                        toast("Student updated");
                        showContacts();
                    }, this::toast);
                }).show();
    }

    private void startCall(JSONObject contact) {
        String id = contact.optString("_id");
        if (!callsInFlight.add(id)) return;
        JSONObject body = new JSONObject();
        try { body.put("contactId", id); body.put("idempotencyKey", UUID.randomUUID().toString()); }
        catch (JSONException ignored) { }
        apiCall(() -> api.post("/communications/call", body), communication -> apiCall(() -> {
            JSONObject callBody = new JSONObject();
            callBody.put("contactId", id);
            api.post("/calls", callBody);
            return communication;
        }, result -> {
            callsInFlight.remove(id);
            String number = result.optString("dialNumber", contact.optString("phone"));
            Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)));
            if (dial.resolveActivity(getPackageManager()) != null) startActivity(dial);
            else toast("No phone app is available");
        }, error -> { callsInFlight.remove(id); toast(error); }), error -> { callsInFlight.remove(id); toast(error); });
    }

    private void showCalls() {
        currentPage = "Calls";
        content.removeAllViews();
        pageHeading("Calls", "Tracked calls and their outcomes.");
        LinearLayout list = vertical();
        content.addView(list);
        addProgress(list, "Loading call history...");
        apiCall(() -> api.get("/calls"), response -> {
            list.removeAllViews();
            JSONArray calls = response.optJSONArray("calls");
            JSONObject summary = response.optJSONObject("summary");
            if (summary != null) list.addView(text(summary.optInt("total", 0) + " calls  ·  " + summary.optInt("attended", 0) + " attended", 14, 0xff607087, true), marginParams(-1, -2, 0, 0, 0, 12));
            if (calls == null || calls.length() == 0) list.addView(emptyState("No calls yet", "Calls you start will appear here."));
            else for (int index = 0; index < calls.length(); index++) {
                JSONObject call = calls.optJSONObject(index);
                if (call != null) list.addView(callCard(call), marginParams(-1, -2, 0, 0, 0, 12));
            }
        }, message -> showError(list, message, this::showCalls));
    }

    private View callCard(JSONObject call) {
        MaterialCardView card = card();
        LinearLayout column = vertical();
        column.addView(text(call.optString("studentName", call.optString("contactName", "Student")), 17, 0xff162a42, true));
        column.addView(text(call.optString("status", "unknown") + "  ·  " + call.optString("durationLabel", ""), 13, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 0));
        JSONArray notes = call.optJSONArray("notes");
        if (notes != null) for (int i = 0; i < Math.min(notes.length(), 2); i++) {
            JSONObject note = notes.optJSONObject(i);
            if (note != null) column.addView(text(note.optString("summary", ""), 13, 0xff455468, false), marginParams(-1, -2, 0, 6, 0, 0));
        }
        LinearLayout actions = new LinearLayout(this);
        Spinner status = spinner(new String[]{"ringing", "attended", "missed", "no-answer", "busy", "wrong-number", "cancelled"});
        String currentStatus = call.optString("status", "ringing");
        setSpinner(status, new String[]{"ringing", "attended", "missed", "no-answer", "busy", "wrong-number", "cancelled"}, currentStatus);
        actions.addView(status, new LinearLayout.LayoutParams(0, dp(50), 1));
        MaterialButton save = button("Update", true);
        actions.addView(save, marginParams(0, dp(46), 8, 0, 0, 0, 1));
        MaterialButton noteButton = button("Note", false);
        actions.addView(noteButton, marginParams(0, dp(46), 4, 0, 0, 0, 1));
        column.addView(actions, marginParams(-1, -2, 0, 10, 0, 0));
        save.setOnClickListener(view -> {
            JSONObject body = new JSONObject();
            try { body.put("status", String.valueOf(status.getSelectedItem())); }
            catch (JSONException ignored) { }
            apiCall(() -> api.patch("/calls/" + call.optString("_id"), body), result -> showCalls(), this::toast);
        });
        noteButton.setOnClickListener(view -> showNoteDialog(call.optString("_id"), true, null));
        if (hasPermission("canDeleteContacts")) {
            MaterialButton delete = button("Delete call record", false);
            column.addView(delete, marginParams(-1, dp(42), 0, 6, 0, 0));
            delete.setOnClickListener(view -> new AlertDialog.Builder(this).setTitle("Delete call record?")
                    .setNegativeButton("Cancel", null).setPositiveButton("Delete", (dialog, which) ->
                            apiCall(() -> { api.delete("/calls/" + call.optString("_id")); return new JSONObject(); }, result -> showCalls(), this::toast)).show());
        }
        card.addView(column);
        return card;
    }

    private void showUpload() {
        currentPage = "Add";
        content.removeAllViews();
        pageHeading("Add student", "Add a single student or import a CSV.");
        MaterialButton manual = button("Manual student entry", true);
        content.addView(manual, marginParams(-1, dp(52), 0, 0, 0, 10));
        manual.setOnClickListener(view -> showManualStudentForm());
        if (hasPermission("canBulkUpload")) {
            MaterialButton choose = button("Select CSV to preview and import", false);
            content.addView(choose, marginParams(-1, dp(52), 0, 0, 0, 10));
            choose.setOnClickListener(view -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("text/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, PICK_CSV);
            });
            MaterialButton export = button("Export filtered students", false);
            content.addView(export, marginParams(-1, dp(52), 0, 0, 0, 10));
            export.setOnClickListener(view -> exportContacts());
        }
        if (hasPermission("canManageUsers")) {
            MaterialButton teacher = button("Create teacher account", false);
            content.addView(teacher, marginParams(-1, dp(52), 0, 0, 0, 10));
            teacher.setOnClickListener(view -> showCreateTeacher());
            MaterialButton teacherCsv = button("Import teachers from CSV", false);
            content.addView(teacherCsv, marginParams(-1, dp(52), 0, 0, 0, 10));
            teacherCsv.setOnClickListener(view -> {
                teacherCsvMode = true;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("text/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, PICK_CSV);
            });
            MaterialButton teacherTemplate = button("Save teacher CSV template", false);
            content.addView(teacherTemplate, marginParams(-1, dp(52), 0, 0, 0, 10));
            teacherTemplate.setOnClickListener(view -> saveCsvTemplate("educonnect-teachers-template.csv",
                    "Full Name,Date of Birth,Phone,Email,Password\n"));
        }
    }

    private void showManualStudentForm() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout form = vertical();
        form.setPadding(dp(20), dp(4), dp(20), dp(8));
        EditText name = addInput(form, "Student name *", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, false);
        Spinner admission = spinner(new String[]{"Select admission type", "Regular", "Lateral Entry", "Part Time"});
        form.addView(admission, marginParams(-1, dp(52), 0, 6, 0, 4));
        Spinner department = spinner(new String[]{"Select department", "CSE", "Civil", "AI/ML", "Mech", "ECE", "EEE", "Automobile"});
        form.addView(department, marginParams(-1, dp(52), 0, 0, 0, 4));
        admission.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                updateDepartmentOptions(department, position == 0 ? "" : (String) admission.getSelectedItem(), "");
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        EditText phone = addInput(form, "Parent/guardian phone *", InputType.TYPE_CLASS_PHONE, false);
        EditText notes = addInput(form, "Notes", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, false);
        JSONArray fields = customFields;
        JSONObject customValues = new JSONObject();
        ArrayList<View> customInputs = new ArrayList<>();
        ArrayList<JSONObject> customDefs = new ArrayList<>();
        for (int index = 0; index < fields.length(); index++) {
            JSONObject field = fields.optJSONObject(index);
            if (field == null || !field.optBoolean("formVisible", true) || !"active".equals(field.optString("state", "active"))) continue;
            String type = field.optString("type", "text");
            String label = field.optString("label") + (field.optBoolean("required") ? " *" : "");
            View input;
            if ("boolean".equals(type)) {
                CheckBox checkbox = new CheckBox(this);
                checkbox.setText(label);
                input = checkbox;
                form.addView(input, marginParams(-1, -2, 0, 3, 0, 7));
            } else if ("select".equals(type) || "multi_select".equals(type)) {
                LinearLayout options = vertical();
                options.addView(text(label, 14, 0xff455468, true), marginParams(-1, -2, 0, 3, 0, 3));
                JSONArray choices = field.optJSONArray("options");
                if ("select".equals(type)) {
                    Spinner select = spinner(optionLabels(choices));
                    options.addView(select, marginParams(-1, dp(50), 0, 0, 0, 5));
                    input = select;
                } else {
                    ArrayList<CheckBox> selections = new ArrayList<>();
                    if (choices != null) for (int choiceIndex = 0; choiceIndex < choices.length(); choiceIndex++) {
                        JSONObject choice = choices.optJSONObject(choiceIndex);
                        if (choice == null) continue;
                        CheckBox check = new CheckBox(this);
                        check.setText(choice.optString("label", choice.optString("value")));
                        selections.add(check);
                        options.addView(check, marginParams(-1, -2, 0, 0, 0, 0));
                    }
                    input = options;
                    input.setTag(selections);
                }
                form.addView(options, marginParams(-1, -2, 0, 0, 0, 7));
            } else {
                int inputType = "number".equals(type) ? InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL
                        : "email".equals(type) ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                        : "phone".equals(type) ? InputType.TYPE_CLASS_PHONE
                        : "date".equals(type) ? InputType.TYPE_CLASS_DATETIME
                        : InputType.TYPE_CLASS_TEXT;
                EditText edit = addInput(form, label, inputType, false);
                edit.setHint(field.optString("placeholder", field.optString("label")));
                if ("long_text".equals(type)) edit.setSingleLine(false);
                input = edit;
            }
            customInputs.add(input);
            customDefs.add(field);
        }
        scroll.addView(form);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Add student").setView(scroll).setNegativeButton("Cancel", null).setPositiveButton("Save student", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String studentName = value(name).trim();
            String admissionType = admission.getSelectedItemPosition() == 0 ? "" : (String) admission.getSelectedItem();
            String dept = department.getSelectedItemPosition() == 0 ? "" : (String) department.getSelectedItem();
            if (studentName.isEmpty() || admissionType.isEmpty() || dept.isEmpty() || value(phone).trim().isEmpty()) {
                toast("Complete all required student fields");
                return;
            }
            JSONObject body = new JSONObject();
            try {
                body.put("studentName", studentName);
                body.put("admissionType", admissionType);
                body.put("department", dept);
                body.put("guardianPhone", value(phone).trim());
                body.put("notes", value(notes).trim());
                for (int index = 0; index < customInputs.size(); index++) {
                    JSONObject field = customDefs.get(index);
                    String type = field.optString("type", "text");
                    View fieldInput = customInputs.get(index);
                    Object fieldValue = null;
                    boolean empty = false;
                    if ("boolean".equals(type)) {
                        boolean checked = ((CheckBox) fieldInput).isChecked();
                        fieldValue = checked;
                        empty = field.optBoolean("required") && !checked;
                    } else if ("select".equals(type)) {
                        Spinner select = (Spinner) fieldInput;
                        int selected = select.getSelectedItemPosition();
                        JSONArray choices = field.optJSONArray("options");
                        if (selected == 0) empty = true;
                        else if (choices != null && choices.optJSONObject(selected - 1) != null) fieldValue = choices.optJSONObject(selected - 1).optString("value");
                    } else if ("multi_select".equals(type)) {
                        JSONArray choices = field.optJSONArray("options");
                        JSONArray selected = new JSONArray();
                        @SuppressWarnings("unchecked") ArrayList<CheckBox> checkboxes = (ArrayList<CheckBox>) fieldInput.getTag();
                        for (int choiceIndex = 0; choiceIndex < checkboxes.size(); choiceIndex++) {
                            if (checkboxes.get(choiceIndex).isChecked() && choices != null && choices.optJSONObject(choiceIndex) != null) {
                                selected.put(choices.optJSONObject(choiceIndex).optString("value"));
                            }
                        }
                        fieldValue = selected;
                        empty = selected.length() == 0;
                    } else {
                        String raw = value((EditText) fieldInput).trim();
                        empty = raw.isEmpty();
                        if (!empty) fieldValue = "number".equals(type) ? Double.parseDouble(raw) : raw;
                    }
                    if (field.optBoolean("required") && empty) {
                        toast(field.optString("label") + " is required");
                        return;
                    }
                    if (fieldValue != null || "boolean".equals(type)) customValues.put(field.optString("key"), fieldValue);
                }
                body.put("customFields", customValues);
            } catch (JSONException error) {
                toast("Could not prepare student record");
                return;
            }
            Button save = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            save.setEnabled(false);
            apiCall(() -> api.post("/uploads/manual", body), result -> {
                dialog.dismiss();
                toast(result.optString("message", "Student added"));
                if (navigation != null) navigation.setSelectedItemId(PAGE_CONTACTS);
            }, error -> { save.setEnabled(true); toast(error); });
        }));
        dialog.show();
    }

    private void previewCsv(Uri uri) {
        try {
            byte[] bytes = readUri(uri);
            String filename = queryDisplayName(uri);
            if (teacherCsvMode) {
                previewTeacherCsv(filename, bytes);
                return;
            }
            apiCall(() -> api.uploadCsv("/uploads/csv/preview", filename, bytes), preview -> {
                StringBuilder summary = new StringBuilder("Valid rows: ").append(preview.optInt("validRows", 0)).append(" of ").append(preview.optInt("totalRows", 0));
                JSONArray errors = preview.optJSONArray("errors");
                if (errors != null) for (int i = 0; i < Math.min(errors.length(), 10); i++) summary.append("\n\n").append(errors.optString(i));
                new AlertDialog.Builder(this).setTitle("CSV preview").setMessage(summary.toString())
                        .setNegativeButton("Cancel", null)
                        .setPositiveButton("Import valid rows", (dialog, which) -> apiCall(() -> api.uploadCsv("/uploads/csv/import", filename, bytes), result -> {
                            toast("Imported " + result.optInt("importedCount", 0) + " students");
                            if (navigation != null) navigation.setSelectedItemId(PAGE_CONTACTS);
                        }, this::toast)).show();
            }, this::toast);
        } catch (Exception error) {
            toast("Could not read the selected CSV");
        }
    }

    private void previewTeacherCsv(String filename, byte[] bytes) {
        apiCall(() -> api.uploadCsv("/uploads/teachers/csv/preview", filename, bytes), preview -> {
            StringBuilder summary = new StringBuilder("Valid rows: ").append(preview.optInt("validRows", 0)).append(" of ").append(preview.optInt("totalRows", 0));
            JSONArray errors = preview.optJSONArray("errors");
            if (errors != null) for (int index = 0; index < Math.min(errors.length(), 12); index++) {
                JSONObject error = errors.optJSONObject(index);
                if (error != null) summary.append("\n\nRow ").append(error.optInt("row")).append(": ").append(error.optString("message"));
            }
            new AlertDialog.Builder(this).setTitle("Teacher CSV preview").setMessage(summary.toString())
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Create valid accounts", (dialog, which) -> apiCall(() -> api.uploadCsv("/uploads/teachers/csv/import", filename, bytes), result -> {
                        toast("Created " + result.optInt("created") + ", skipped " + result.optInt("skipped") + ", failed " + result.optInt("failed"));
                        teacherCsvMode = false;
                        showAdminTools();
                    }, this::toast)).show();
        }, message -> { teacherCsvMode = false; toast(message); });
    }

    private void saveCsvTemplate(String filename, String contents) {
        pendingExport = contents.getBytes(StandardCharsets.UTF_8);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/csv");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(intent, SAVE_CSV);
    }

    private byte[] readUri(Uri uri) throws Exception {
        try (InputStream input = getContentResolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new java.io.IOException("Could not open selected file");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_CSV_BYTES) throw new java.io.IOException("CSV files must be 10 MB or smaller");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private String queryDisplayName(Uri uri) {
        String name = "students.csv";
        try (android.database.Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) name = cursor.getString(column);
            }
        } catch (Exception ignored) { }
        return name;
    }

    private void exportContacts() {
        exportContacts(null);
    }

    private void exportContacts(LinkedHashSet<String> ids) {
        StringBuilder path = new StringBuilder("/contacts/export");
        ArrayList<String> filters = new ArrayList<>();
        if (!searchText.isEmpty()) filters.add("search=" + NativeApi.encode(searchText));
        if (!admissionFilter.isEmpty()) filters.add("admissionType=" + NativeApi.encode(admissionFilter));
        if (!departmentFilter.isEmpty()) filters.add("department=" + NativeApi.encode(departmentFilter));
        if (!statusFilter.isEmpty()) filters.add("status=" + NativeApi.encode(statusFilter));
        if (ids != null && !ids.isEmpty()) filters.add("ids=" + NativeApi.encode(android.text.TextUtils.join(",", ids)));
        if (!filters.isEmpty()) path.append('?').append(android.text.TextUtils.join("&", filters));
        apiCallGeneric(() -> api.download(path.toString()), csv -> {
            pendingExport = csv;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("text/csv");
            intent.putExtra(Intent.EXTRA_TITLE, "educonnect-students.csv");
            startActivityForResult(intent, SAVE_CSV);
        }, this::toast);
    }

    private void showCreateTeacher() {
        LinearLayout form = vertical();
        EditText name = addInput(form, "Full name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, false);
        EditText email = addInput(form, "Email", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, false);
        EditText phone = addInput(form, "Phone", InputType.TYPE_CLASS_PHONE, false);
        EditText dob = addInput(form, "Date of birth", InputType.TYPE_CLASS_DATETIME, false);
        dob.setFocusable(false);
        dob.setOnClickListener(view -> chooseDate(dob));
        EditText password = addInput(form, "Temporary password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
        new AlertDialog.Builder(this).setTitle("Create teacher").setView(form).setNegativeButton("Cancel", null)
                .setPositiveButton("Create", (dialog, which) -> {
                    JSONObject body = new JSONObject();
                    try { body.put("name", value(name).trim()); body.put("email", value(email).trim()); body.put("phone", value(phone).trim()); body.put("dateOfBirth", value(dob).trim()); body.put("password", value(password)); }
                    catch (JSONException ignored) { }
                    apiCall(() -> api.post("/uploads/teachers/manual", body), result -> toast("Teacher account created"), this::toast);
                }).show();
    }

    private void showSettings() {
        currentPage = "Settings";
        content.removeAllViews();
        pageHeading("Settings", "Account and administration.");
        content.addView(text(user.optString("name", ""), 20, 0xff162a42, true));
        content.addView(text(user.optString("email", ""), 14, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 0));
        content.addView(text("Role: " + user.optString("role", "teacher"), 13, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 0));
        SwitchMaterial themeSwitch = new SwitchMaterial(this);
        themeSwitch.setText("Dark theme");
        themeSwitch.setChecked(getPreferences(MODE_PRIVATE).getBoolean("dark_mode", false));
        content.addView(themeSwitch, marginParams(-1, dp(52), 0, 8, 0, 0));
        themeSwitch.setOnCheckedChangeListener((button, checked) -> {
            getPreferences(MODE_PRIVATE).edit().putBoolean("dark_mode", checked).apply();
            AppCompatDelegate.setDefaultNightMode(checked ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO);
        });
        MaterialButton refresh = button("Refresh account", false);
        content.addView(refresh, marginParams(-1, dp(48), 0, 14, 0, 0));
        refresh.setOnClickListener(view -> apiCall(() -> api.get("/auth/me"), account -> { user = account; showSettings(); }, this::toast));
        if ("admin".equals(user.optString("role"))) {
            MaterialButton admin = button("Teacher accounts and system metrics", false);
            content.addView(admin, marginParams(-1, dp(48), 0, 8, 0, 0));
            admin.setOnClickListener(view -> showAdminTools());
            MaterialButton database = button("Database management", false);
            content.addView(database, marginParams(-1, dp(48), 0, 8, 0, 0));
            database.setOnClickListener(view -> showDatabaseTools());
        }
        MaterialButton fullWorkspace = button("Open full web workspace", false);
        content.addView(fullWorkspace, marginParams(-1, dp(48), 0, 18, 0, 0));
        fullWorkspace.setOnClickListener(view -> startActivity(new Intent(this, MainActivity.class)));
        MaterialButton logout = button("Sign out", true);
        logout.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff34445b));
        content.addView(logout, marginParams(-1, dp(48), 0, 8, 0, 0));
        logout.setOnClickListener(view -> logout());
    }

    private void showAdminTools() {
        LinearLayout panel = vertical();
        addProgress(panel, "Loading administrator data...");
        apiCall(() -> api.get("/admin/metrics"), metrics -> apiCallGeneric(() -> api.getArray("/admin/teachers"), loadedTeachers -> {
            teachers = loadedTeachers;
            panel.removeAllViews();
            panel.addView(text("Registered teachers: " + metrics.optInt("teacherCount") + "\nStudent contacts: " + metrics.optInt("contactCount"), 16, 0xff162a42, true));
            MaterialButton create = button("Create teacher account", true);
            panel.addView(create, marginParams(-1, dp(48), 0, 14, 0, 0));
            create.setOnClickListener(view -> showCreateTeacher());
            MaterialButton fields = button("Manage student columns", false);
            panel.addView(fields, marginParams(-1, dp(48), 0, 8, 0, 0));
            fields.setOnClickListener(view -> showCustomFieldTools());
            for (int index = 0; index < teachers.length(); index++) {
                JSONObject teacher = teachers.optJSONObject(index);
                if (teacher == null) continue;
                MaterialButton row = button(teacher.optString("name") + "  ·  " + teacher.optString("email"), false);
                panel.addView(row, marginParams(-1, dp(48), 0, 8, 0, 0));
                row.setOnClickListener(view -> new AlertDialog.Builder(this).setTitle("Delete teacher?")
                        .setMessage("Assigned students will be unassigned by the server.")
                        .setNegativeButton("Cancel", null).setPositiveButton("Delete", (dialog, which) ->
                                apiCall(() -> { api.delete("/admin/teachers/" + teacher.optString("id")); return new JSONObject(); }, result -> showAdminTools(), this::toast)).show());
            }
        }, message -> showError(panel, message, this::showAdminTools)), message -> showError(panel, message, this::showAdminTools));
        showPanelDialog("Administration", panel);
    }

    private void showDatabaseTools() {
        apiCall(() -> api.get("/admin/database/status"), status -> {
            String active = status.optString("provider", "atlas");
            String databaseName = status.optString("databaseName", "edustaff-connect");
            LinearLayout form = vertical();
            form.setPadding(dp(20), dp(4), dp(20), dp(4));
            TextView current = text("Active: " + active + " / " + databaseName, 15, 0xff162a42, true);
            form.addView(current, marginParams(-1, -2, 0, 0, 0, 12));
            Spinner provider = spinner(new String[]{"atlas", "local"});
            form.addView(provider, marginParams(-1, dp(50), 0, 0, 0, 8));
            EditText db = addInput(form, "Target database name", InputType.TYPE_CLASS_TEXT, false);
            db.setText(databaseName);
                MaterialButton localSetup = button("Check / start local MongoDB service", false);
                form.addView(localSetup, marginParams(-1, dp(46), 0, 8, 0, 0));
                localSetup.setOnClickListener(view -> apiCall(() -> api.post("/admin/database/setup-local", new JSONObject()), result ->
                    new AlertDialog.Builder(this).setTitle("Local database setup").setMessage(result.optString("message", "Check completed"))
                        .setPositiveButton("Close", null).show(), this::toast));
            new AlertDialog.Builder(this).setTitle("Database management").setView(form)
                    .setNeutralButton("Check connection", (dialog, which) -> databaseTest((String) provider.getSelectedItem(), value(db).trim()))
                    .setNegativeButton("Close", null)
                    .setPositiveButton("Test and switch", (dialog, which) -> new AlertDialog.Builder(this)
                            .setTitle("Confirm database switch")
                            .setMessage("The server verifies the target. Database records are isolated and are not copied or deleted.")
                            .setNegativeButton("Cancel", null)
                            .setPositiveButton("Continue", (confirm, action) -> databaseSwitch((String) provider.getSelectedItem(), value(db).trim()))
                            .show()).show();
        }, this::toast);
    }

    private void showCustomFieldTools() {
        LinearLayout panel = vertical();
        MaterialButton add = button("Add student column", true);
        panel.addView(add, marginParams(-1, dp(48), 0, 0, 0, 10));
        add.setOnClickListener(view -> editCustomField(null));
        apiCallGeneric(() -> api.getArray("/custom-fields?includeArchived=true"), fields -> {
            panel.removeAllViews();
            panel.addView(add, marginParams(-1, dp(48), 0, 0, 0, 10));
            if (fields.length() == 0) panel.addView(emptyState("No custom columns", "Add a field to extend student records."));
            for (int index = 0; index < fields.length(); index++) {
                JSONObject field = fields.optJSONObject(index);
                if (field == null) continue;
                String state = field.optString("state", "active");
                MaterialButton row = button(field.optString("label") + "  ·  " + field.optString("type") + "  ·  " + state, false);
                panel.addView(row, marginParams(-1, dp(48), 0, 0, 0, 8));
                row.setOnClickListener(view -> editCustomField(field));
            }
        }, this::toast);
        showPanelDialog("Student columns", panel);
    }

    private void editCustomField(@Nullable JSONObject existing) {
        LinearLayout form = vertical();
        form.setPadding(dp(20), dp(4), dp(20), dp(4));
        EditText label = addInput(form, "Column name", InputType.TYPE_CLASS_TEXT, false);
        EditText key = addInput(form, "Field ID (lowercase, underscores)", InputType.TYPE_CLASS_TEXT, false);
        Spinner type = spinner(new String[]{"text", "long_text", "number", "email", "phone", "date", "select", "multi_select", "boolean", "url"});
        form.addView(type, marginParams(-1, dp(50), 0, 0, 0, 8));
        EditText options = addInput(form, "Choice labels, comma separated", InputType.TYPE_CLASS_TEXT, false);
        CheckBox required = new CheckBox(this);
        required.setText("Required for new students");
        form.addView(required);
        CheckBox searchable = new CheckBox(this);
        searchable.setText("Searchable");
        form.addView(searchable);
        CheckBox filterable = new CheckBox(this);
        filterable.setText("Filterable");
        form.addView(filterable);
        if (existing != null) {
            label.setText(existing.optString("label"));
            key.setText(existing.optString("key"));
            key.setEnabled(false);
            setSpinner(type, new String[]{"text", "long_text", "number", "email", "phone", "date", "select", "multi_select", "boolean", "url"}, existing.optString("type", "text"));
            required.setChecked(existing.optBoolean("required"));
            searchable.setChecked(existing.optBoolean("searchable"));
            filterable.setChecked(existing.optBoolean("filterable", true));
            JSONArray existingOptions = existing.optJSONArray("options");
            if (existingOptions != null) {
                ArrayList<String> labels = new ArrayList<>();
                for (int index = 0; index < existingOptions.length(); index++) {
                    JSONObject option = existingOptions.optJSONObject(index);
                    if (option != null) labels.add(option.optString("label"));
                }
                options.setText(android.text.TextUtils.join(", ", labels));
            }
        }
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(existing == null ? "Add student column" : "Edit student column")
                .setView(form).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create();
        if (existing != null && "archived".equals(existing.optString("state"))) {
            dialog.setButton(AlertDialog.BUTTON_NEUTRAL, "Restore", (target, which) ->
                    apiCall(() -> api.post("/custom-fields/" + existing.optString("_id") + "/restore", new JSONObject()), result -> showCustomFieldTools(), this::toast));
        } else if (existing != null) {
            dialog.setButton(AlertDialog.BUTTON_NEUTRAL, "Archive", (target, which) -> {
                JSONObject body = new JSONObject();
                try { body.put("state", "archived"); }
                catch (JSONException ignored) { }
                apiCall(() -> api.patch("/custom-fields/" + existing.optString("_id"), body), result -> showCustomFieldTools(), this::toast);
            });
        }
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String fieldLabel = value(label).trim();
            String fieldKey = value(key).trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
            if (fieldKey.isEmpty() || !fieldKey.matches("[a-z][a-z0-9_]{0,63}")) {
                toast("Field ID must start with a letter and use only letters, numbers, or underscores");
                return;
            }
            JSONObject body = new JSONObject();
            try {
                body.put("label", fieldLabel);
                body.put("key", fieldKey);
                body.put("type", type.getSelectedItem());
                body.put("required", required.isChecked());
                body.put("searchable", searchable.isChecked());
                body.put("filterable", filterable.isChecked());
                body.put("formVisible", true);
                body.put("tableVisible", true);
                body.put("importable", true);
                JSONArray choices = new JSONArray();
                for (String choice : value(options).split(",")) {
                    String optionLabel = choice.trim();
                    if (optionLabel.isEmpty()) continue;
                    String optionValue = optionLabel.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
                    JSONObject option = new JSONObject();
                    option.put("label", optionLabel);
                    option.put("value", optionValue);
                    choices.put(option);
                }
                body.put("options", choices);
            } catch (JSONException error) {
                toast("Could not prepare custom column");
                return;
            }
            String id = existing == null ? "" : existing.optString("_id");
            apiCall(() -> existing == null ? api.post("/custom-fields", body) : api.patch("/custom-fields/" + id, body),
                    result -> { dialog.dismiss(); showCustomFieldTools(); }, this::toast);
        }));
        dialog.show();
    }

    private void databaseTest(String provider, String database) {
        JSONObject body = new JSONObject();
        try { body.put("provider", provider); body.put("databaseName", database); }
        catch (JSONException ignored) { }
        apiCall(() -> api.post("/admin/database/test", body), result -> toast("Connection verified: " + result.optInt("latencyMs") + " ms"), this::toast);
    }

    private void databaseSwitch(String provider, String database) {
        JSONObject body = new JSONObject();
        try { body.put("provider", provider); body.put("databaseName", database); }
        catch (JSONException ignored) { }
        apiCall(() -> api.post("/admin/database/switch", body), result -> toast("Database switch completed"), this::toast);
    }

    private void showPanelDialog(String title, View panel) {
        new AlertDialog.Builder(this).setTitle(title).setView(panel).setPositiveButton("Close", null).show();
    }

    private void showAccount() {
        String permissions = user.optJSONObject("permissions") == null ? "" : user.optJSONObject("permissions").toString();
        new AlertDialog.Builder(this).setTitle(user.optString("name", "Account"))
                .setMessage(user.optString("email") + "\n\n" + ("admin".equals(user.optString("role")) ? "Administrator" : "Teacher")
                        + (permissions.isEmpty() ? "" : "\n\nPermissions\n" + permissions))
                .setPositiveButton("Close", null).setNeutralButton("Sign out", (dialog, which) -> logout()).show();
    }

    private void logout() {
        apiCall(() -> api.post("/auth/logout", new JSONObject()), result -> {
            session.clear(); user = null; showAuth(false);
        }, message -> {
            session.clear(); user = null; showAuth(false);
        });
    }

    private void pageHeading(String title, String subtitle) {
        content.addView(text(title, 28, 0xff162a42, true));
        content.addView(text(subtitle, 14, 0xff607087, false), marginParams(-1, -2, 0, 4, 0, 18));
    }

    private MaterialCardView card() {
        MaterialCardView card = new MaterialCardView(this);
        card.setRadius(dp(14));
        card.setCardBackgroundColor(Color.WHITE);
        card.setStrokeColor(0xffe1e7ef);
        card.setStrokeWidth(dp(1));
        card.setCardElevation(dp(1));
        card.setUseCompatPadding(true);
        card.setContentPadding(dp(14), dp(12), dp(14), dp(12));
        return card;
    }

    private LinearLayout vertical() {
        LinearLayout result = new LinearLayout(this);
        result.setOrientation(LinearLayout.VERTICAL);
        return result;
    }

    private View emptyState(String title, String detail) {
        LinearLayout state = vertical();
        state.setGravity(Gravity.CENTER);
        state.setPadding(dp(18), dp(32), dp(18), dp(32));
        state.addView(text(title, 18, 0xff162a42, true));
        state.addView(text(detail, 14, 0xff607087, false), marginParams(-1, -2, 0, 6, 0, 0));
        return state;
    }

    private void addProgress(LinearLayout parent, String message) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        ProgressBar spinner = new ProgressBar(this);
        row.addView(spinner, marginParams(dp(28), dp(28), 0, 0, 12, 0));
        row.addView(text(message, 14, 0xff607087, false));
        parent.addView(row, marginParams(-1, dp(60), 0, 12, 0, 12));
    }

    private void showError(LinearLayout target, String message, Runnable retry) {
        target.removeAllViews();
        target.addView(text(message, 14, 0xffb3261e, true), marginParams(-1, -2, 0, 0, 0, 8));
        MaterialButton button = button("Retry", false);
        target.addView(button, marginParams(-1, dp(46), 0, 0, 0, 0));
        button.setOnClickListener(view -> retry.run());
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        return view;
    }

    private EditText addInput(LinearLayout parent, String hint, int inputType, boolean password) {
        TextInputLayout wrapper = new TextInputLayout(this);
        wrapper.setHint(hint);
        wrapper.setBoxBackgroundMode(TextInputLayout.BOX_BACKGROUND_OUTLINE);
        wrapper.setBoxCornerRadii(dp(10), dp(10), dp(10), dp(10));
        TextInputEditText field = new TextInputEditText(wrapper.getContext());
        field.setInputType(inputType);
        field.setSingleLine((inputType & InputType.TYPE_TEXT_FLAG_MULTI_LINE) == 0);
        if (password) field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        wrapper.addView(field, new TextInputLayout.LayoutParams(-1, -2));
        wrapper.setLayoutParams(marginParams(-1, -2, 0, 0, 0, 10));
        if (parent != null) parent.addView(wrapper);
        return field;
    }

    private MaterialButton button(String label, boolean primary) {
        MaterialButton button = new MaterialButton(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setCornerRadius(dp(11));
        if (primary) {
            button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff1559a8));
            button.setTextColor(Color.WHITE);
        } else {
            button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffe9eef5));
            button.setTextColor(0xff19314f);
        }
        return button;
    }

    private Spinner spinner(String[] options) {
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, options);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
        return spinner;
    }

    private String[] optionLabels(JSONArray options) {
        ArrayList<String> labels = new ArrayList<>();
        labels.add("Select");
        if (options != null) for (int index = 0; index < options.length(); index++) {
            JSONObject option = options.optJSONObject(index);
            if (option != null) labels.add(option.optString("label", option.optString("value")));
        }
        return labels.toArray(new String[0]);
    }

    private void updateDepartmentOptions(Spinner department, String admissionType, String selected) {
        ArrayList<String> values = new ArrayList<>();
        values.add("Select department");
        if ("Part Time".equals(admissionType)) {
            values.add("EEE");
            values.add("Mech");
        } else if ("Regular".equals(admissionType) || "Lateral Entry".equals(admissionType)) {
            values.add("CSE");
            values.add("Civil");
            values.add("AI/ML");
            values.add("Mech");
            values.add("ECE");
            values.add("EEE");
            values.add("Automobile");
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, values);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        department.setAdapter(adapter);
        for (int index = 0; index < values.size(); index++) if (values.get(index).equals(selected)) department.setSelection(index);
    }

    private void setSpinner(Spinner spinner, String[] values, String selected) {
        for (int index = 0; index < values.length; index++) if (values[index].equals(selected)) spinner.setSelection(index);
    }

    private String value(EditText input) {
        return input.getText() == null ? "" : input.getText().toString();
    }

    private String studentName(JSONObject contact) {
        JSONObject student = contact.optJSONObject("student");
        return student == null ? contact.optString("name", "Student") : student.optString("name", contact.optString("name", "Student"));
    }

    private String join(String left, String right) {
        if (left.isEmpty()) return right;
        if (right.isEmpty()) return left;
        return left + "  ·  " + right;
    }

    private boolean hasPermission(String name) {
        JSONObject permissions = user == null ? null : user.optJSONObject("permissions");
        return permissions != null && permissions.optBoolean(name, false);
    }

    private LinearLayout.LayoutParams marginParams(int width, int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, height);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private LinearLayout.LayoutParams marginParams(int width, int height, int left, int top, int right, int bottom, float weight) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, height, weight);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}