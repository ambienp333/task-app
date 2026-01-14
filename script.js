function cycleView() {
    if (isAnimating) {
        queuedSwipe = true;
        return;
    }
    
    isAnimating = true;
    const wasQueued = queuedSwipe;
    queuedSwipe = false;
    
    currentViewIndex++;
    updatePositions();
    updateBackgroundColor();
    
    setTimeout(() => {
        let hasRepositioned = false;
        views.forEach((view, index) => {
            const position = viewPositions[index];
            
            if (position < currentViewIndex - 2) {
                hasRepositioned = true;
                view.style.transition = 'none';
                view.style.opacity = '0';
                
                viewPositions[index] = currentViewIndex + 3;
                view.offsetHeight;
                
                const offset = (viewPositions[index] - currentViewIndex) * 100;
                view.style.transform = `translateY(${offset}vh)`;
                
                setTimeout(() => {
                    view.style.transition = 'transform 350ms ease-in-out';
                    view.style.opacity = '1';
                }, 50);
            }
        });
        
        // Unlock and check for queued swipe in a single final timeout
        const unlockDelay = hasRepositioned ? 50 : 0;
        setTimeout(() => {
            isAnimating = false;
            if (queuedSwipe) {
                // Use setTimeout to ensure unlock completes first
                setTimeout(() => cycleView(), 0);
            }
        }, unlockDelay);
    }, 350);
}
