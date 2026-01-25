/**
 * Utility for conditionally joining class names
 * Similar to clsx/classnames but minimal implementation
 */

type ClassValue = string | number | boolean | undefined | null | ClassArray | ClassObject;
type ClassArray = ClassValue[];
type ClassObject = Record<string, boolean | undefined | null>;

function toVal(mix: ClassValue): string {
  let str = '';

  if (typeof mix === 'string' || typeof mix === 'number') {
    str += mix;
  } else if (Array.isArray(mix)) {
    for (const item of mix) {
      const val = toVal(item);
      if (val) {
        str && (str += ' ');
        str += val;
      }
    }
  } else if (typeof mix === 'object' && mix !== null) {
    for (const key of Object.keys(mix)) {
      if ((mix as ClassObject)[key]) {
        str && (str += ' ');
        str += key;
      }
    }
  }

  return str;
}

/**
 * Conditionally join class names together
 *
 * @example
 * cn('foo', 'bar') // => 'foo bar'
 * cn('foo', { bar: true }) // => 'foo bar'
 * cn({ foo: true, bar: false }) // => 'foo'
 * cn(['foo', 'bar']) // => 'foo bar'
 * cn('foo', condition && 'bar') // => 'foo bar' or 'foo'
 */
export function cn(...args: ClassValue[]): string {
  let str = '';
  for (const arg of args) {
    const val = toVal(arg);
    if (val) {
      str && (str += ' ');
      str += val;
    }
  }
  return str;
}
