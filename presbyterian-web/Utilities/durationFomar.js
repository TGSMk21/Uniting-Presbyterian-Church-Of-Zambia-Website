export function formatYouTubeDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

  if(!match) return 'LIVE';

  const hours = (match[1] || '').replace('H', '');
  const mins = (match[2] || '').replace('M', '');
  const secs = (match[3] || '').replace('S', '');

  let result = "";
  if (hours) result += `${hours}:`;
  result += `${mins.padStart(hours ? 2 : 1, '0')}:`;
  result += secs.padStart(2, '0');
  
  return result;
}