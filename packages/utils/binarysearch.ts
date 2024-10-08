export const findClosest = (array: number[], target: number): number => {
    let left = 0;
    let right = array.length - 1;
  
    if (target <= array[left]) return array[left];
    if (target >= array[right]) return array[right];
  
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
  
      if (array[mid] === target) {
        return array[mid];
      } else if (array[mid] < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  
    const closestLeft = array[right];
    const closestRight = array[left];
  
    return Math.abs(closestLeft - target) < Math.abs(closestRight - target)
      ? closestLeft
      : closestRight;
  };