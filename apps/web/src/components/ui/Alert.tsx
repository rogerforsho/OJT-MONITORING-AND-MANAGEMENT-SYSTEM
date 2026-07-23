interface AlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

const styles = {
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-teal-50 border-teal-200 text-teal-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function Alert({ type, message }: AlertProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      {message}
    </div>
  );
}
