import React, { useState, useEffect } from 'react';

interface WindowAnimationProps {
  children: React.ReactNode;
  isVisible: boolean;
  animationDuration?: number;
}

const WindowAnimation: React.FC<WindowAnimationProps> = ({ 
  children, 
  isVisible, 
  animationDuration = 300 
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [animationState, setAnimationState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');

  useEffect(() => {
    console.log('🎦 ALT+C: WindowAnimation effect - isVisible:', isVisible, 'current state:', animationState);
    
    if (isVisible) {
      console.log('🎦 ALT+C: WindowAnimation - Starting show animation');
      // Start showing the component
      setShouldRender(true);
      // Small delay to ensure DOM is ready, then start animation
      const enterTimer = setTimeout(() => {
        console.log('🎦 ALT+C: WindowAnimation - Setting state to entering');
        setAnimationState('entering');
        // After animation duration, set to fully visible
        setTimeout(() => {
          console.log('🎦 ALT+C: WindowAnimation - Animation complete, setting to visible');
          setAnimationState('visible');
        }, animationDuration);
      }, 10);

      return () => clearTimeout(enterTimer);
    } else {
      console.log('🎦 ALT+C: WindowAnimation - Starting exit animation');
      // Start exit animation
      setAnimationState('exiting');
      // After animation completes, remove from DOM
      const exitTimer = setTimeout(() => {
        console.log('🎦 ALT+C: WindowAnimation - Exit complete, setting to hidden');
        setAnimationState('hidden');
        setShouldRender(false);
      }, animationDuration);

      return () => clearTimeout(exitTimer);
    }
  }, [isVisible, animationDuration]);

  if (!shouldRender) {
    return null;
  }

  // Animation styles based on state
  const getAnimationStyles = () => {
    // Less bouncy entrance: reduced the bounce from 1.56 to 1.25
    const entranceTransition = `all ${animationDuration}ms cubic-bezier(0.34, 1.25, 0.64, 1)`;
    // Smooth exit animation
    const exitTransition = `all ${animationDuration * 0.75}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    
    switch (animationState) {
      case 'hidden':
        return {
          opacity: 0,
          transform: 'scale(0.85) translateY(-8px)',
          transition: entranceTransition,
        };
      case 'entering':
        return {
          opacity: 1,
          transform: 'scale(1) translateY(0px)',
          transition: entranceTransition,
        };
      case 'visible':
        return {
          opacity: 1,
          transform: 'scale(1) translateY(0px)',
          transition: 'none', // Remove transition when fully visible for performance
        };
      case 'exiting':
        return {
          opacity: 0,
          transform: 'scale(0.92) translateY(3px)', 
          transition: exitTransition,
        };
      default:
        return {};
    }
  };

  return (
    <div
      style={getAnimationStyles()}
      className="w-full h-full"
    >
      {children}
    </div>
  );
};

export default WindowAnimation;
