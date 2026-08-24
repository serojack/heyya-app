import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  }
  if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return format(date, 'EEEE h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
}

export function formatRelativeTime(dateString: string) {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}
