interface AlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

const styles = {
  error: 'bg-red-50 border-red-200 text-red-700 font-medium',
  success: 'bg-[#0A3D24]/10 border-[#0A3D24]/30 text-[#0A3D24] font-bold',
  info: 'bg-blue-50 border-blue-200 text-blue-700 font-medium',
};

export default function Alert({ type, message }: AlertProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${styles[type]}`}>
      {message}
    </div>
  );
}
