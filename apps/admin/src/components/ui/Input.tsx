import { JSX } from 'preact';

interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', id, ...props }: InputProps) {
  return (
    <div class="mb-4">
      {label && (
        <label 
          class="block text-gray-700 text-sm font-bold mb-2" 
          for={id}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        class={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${className}`}
        {...props}
      />
    </div>
  );
}
