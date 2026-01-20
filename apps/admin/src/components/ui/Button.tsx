import { JSX } from 'preact';

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  let variantClass = '';
  
  switch (variant) {
    case 'primary':
      variantClass = 'bg-blue-600 hover:bg-blue-700 text-white';
      break;
    case 'danger':
      variantClass = 'bg-red-600 hover:bg-red-700 text-white';
      break;
    case 'secondary':
      variantClass = 'bg-gray-600 hover:bg-gray-700 text-white';
      break;
  }

  return (
    <button 
      className={`px-3 py-1 rounded transition-colors ${variantClass} ${className}`}
      {...props}
    />
  );
}
