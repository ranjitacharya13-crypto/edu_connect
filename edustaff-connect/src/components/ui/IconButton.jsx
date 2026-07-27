export default function IconButton({ children, className = '', ...props }) {
  return (
    <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-black transition ${className}`} {...props}>
      {children}
    </button>
  )
}
