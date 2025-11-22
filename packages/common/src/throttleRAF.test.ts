// throttleRAF.test.ts

// jest is a function testing framework 


// --- throttleRAF function (inline) --- 
export const throttleRAF = <T extends any[],>(      
    fn: (...args: T) => void,
    opts?: { trailing?: boolean }
  ) => {
    let timerId: number | null = null;
    let lastArgsAndCallTime: { args: T; callTime: number } | null = null;
  
    const execute = () => {
      timerId = null;

      if (lastArgsAndCallTime) {
        const { args, callTime } = lastArgsAndCallTime;
        const execTime = performance.now();

        console.log(`[Throttle] Latency: ${(execTime - callTime).toFixed(2)}ms`);
        fn(...args);
        lastArgsAndCallTime = null;
      }
    };
  
    const ret = (...args: T) => {
      const callTime = performance.now();
      lastArgsAndCallTime = { args, callTime };
      if (timerId === null) timerId = requestAnimationFrame(execute);
    };
  
    ret.flush = () => {
      if (timerId !== null) {
        cancelAnimationFrame(timerId);
        execute();
        timerId = null;
      }
    };
  
    ret.cancel = () => {
      if (timerId !== null) {
        cancelAnimationFrame(timerId);
        timerId = null;
      }
      lastArgsAndCallTime = null;
    };
  
    return ret;
  };
  
  // --- Jest tests ---
  describe('throttleRAF', () => {                           // Test suite for throttleRAF function
    let rafCallbacks: FrameRequestCallback[] = [];          // Array to hold queued RAF callbacks
    let rafId = 0;                                          // Unique ID for each RAF call
    let mockTime = 1000;                                    // Mock time for performance.now()
  
    beforeEach(() => {                                      // Setup before each test
      jest.useFakeTimers();                                 // Use fake timers
      
      // Initialize RAF mocks and time
      rafCallbacks = [];                                    
      rafId = 0;
      mockTime = 1000;
  
      // mock requestAnimationFrame / cancelAnimationFrame
      global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {        
        rafCallbacks.push(cb);                                                      // Store callback
        return ++rafId;                                                             // Return unique ID
      }) as any;                                                                    // Cast to any to satisfy TypeScript
  
      global.cancelAnimationFrame = jest.fn();                                      // Mock cancelAnimationFrame
  
      global.performance = { now: jest.fn(() => mockTime) } as any;                 // Mock performance.now()
    });
  
    afterEach(() => {                                       // Cleanup after each test
      jest.useRealTimers();                                 // Restore real timers
    });
  
    const executeAnimationFrame = () => {                   // Function to simulate RAF execution
      mockTime += 16;                                       // Advance mock time by ~16ms (1 frame at 60fps)
      const callbacks = [...rafCallbacks];                  // Copy current callbacks
      rafCallbacks.length = 0;                              // Clear the original array
      callbacks.forEach(cb => cb(mockTime));                // Execute each callback with the updated mock time
    };
  
    it('throttles multiple calls to one execution per frame with latest args', () => {      // Test case
      const mockFn = jest.fn();                                                             // Mock function to be throttled
      const throttled = throttleRAF(mockFn);                                                // Create throttled version
    
      // Call throttled function multiple times
      throttled('a');
      throttled('b');
      throttled('c');
  
      expect(mockFn).not.toHaveBeenCalled();                // Ensure not called yet
  
      executeAnimationFrame();                              // Simulate RAF execution
  
      expect(mockFn).toHaveBeenCalledTimes(1);              // Ensure called once
      expect(mockFn).toHaveBeenCalledWith('c');             // Ensure called with latest args
    });
  
    it('flush executes immediately', () => {                // Test case for flush
      const mockFn = jest.fn();                             // Mock function to be throttled
      const throttled = throttleRAF(mockFn);                // Create throttled version
  
      throttled('flush-test');                              // Call throttled function
      throttled.flush();                                    // Flush immediately
  
      expect(mockFn).toHaveBeenCalledTimes(1);              // Ensure called once
      expect(mockFn).toHaveBeenCalledWith('flush-test');    // Ensure called with correct args
    });
  
    it('cancel prevents execution', () => {                 // Test case for cancel
      const mockFn = jest.fn();                             // Mock function to be throttled
      const throttled = throttleRAF(mockFn);                // Create throttled version
  
      throttled('cancel-test');                             // Call throttled function
      throttled.cancel();                                   // Cancel the scheduled execution
  
      executeAnimationFrame();                              // Simulate RAF execution
  
      expect(mockFn).not.toHaveBeenCalled();                // Ensure not called after cancel
    });
  });
  