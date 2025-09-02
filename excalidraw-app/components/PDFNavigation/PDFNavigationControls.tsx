import React, { useEffect, useRef } from 'react';
import { useViewportTracking } from './useViewportTracking';
import { usePDFSelection, usePDFNavigation } from './usePDFSelection';
import { getControlsPosition, isControlsVisible } from './coordinateUtils';
import styles from './styles/navigation-controls.module.css';

interface PDFNavigationControlsProps {
	excalidrawAPI: any;
}

export const PDFNavigationControls: React.FC<PDFNavigationControlsProps> = ({ 
	excalidrawAPI 
}) => {
	const viewport = useViewportTracking(excalidrawAPI);
	const pdfSelection = usePDFSelection(excalidrawAPI);
	const { 
		goToPrevPage, 
		goToNextPage, 
		isNavigating, 
		navigationError,
		canNavigatePrev,
		canNavigateNext 
	} = usePDFNavigation(excalidrawAPI, pdfSelection.selectedElement);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const prevBtnRef = useRef<HTMLButtonElement | null>(null);
	const nextBtnRef = useRef<HTMLButtonElement | null>(null);
	const excalidrawRootRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const root = containerRef.current?.closest('.excalidraw') as HTMLElement | null
			|| document.querySelector('.excalidraw') as HTMLElement | null
			|| document.querySelector('.excalidraw__app') as HTMLElement | null
			|| document.body;
		excalidrawRootRef.current = root as HTMLElement | null;
	}, [pdfSelection.isVisible]);

	// Global wheel interception: prevent browser zoom over buttons; re-dispatch to Excalidraw to use native anchored zoom
	useEffect(() => {
		const handleGlobalWheelCapture = (e: WheelEvent) => {
			const target = e.target as HTMLElement | null;
			const overPrev = prevBtnRef.current && target && prevBtnRef.current.contains(target);
			const overNext = nextBtnRef.current && target && nextBtnRef.current.contains(target);
			if (!(overPrev || overNext)) return;

			// Only intercept pinch-zoom gestures
			if (!(e.ctrlKey || e.metaKey)) return;

			// Avoid recursion for synthetic events we dispatch
			if ((e as any).__pdfNavSynth) return;

			// Stop browser/page zoom
			e.preventDefault();
			e.stopPropagation();

			// Re-dispatch a synthetic wheel event on Excalidraw root (or inner canvas container) so native handler runs
			const root = excalidrawRootRef.current || document.body;
			const dispatchTarget = (root.querySelector('.excalidraw__canvas')
				|| root.querySelector('.excalidraw__layer')
				|| root) as HTMLElement;
			try {
				const synth = new WheelEvent('wheel', {
					bubbles: true,
					cancelable: true,
					composed: true,
					clientX: e.clientX,
					clientY: e.clientY,
					deltaX: e.deltaX,
					deltaY: e.deltaY,
					deltaMode: e.deltaMode,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
					shiftKey: e.shiftKey,
					altKey: e.altKey,
				});
				(Object.assign(synth, { __pdfNavSynth: true }) as any);
				dispatchTarget.dispatchEvent(synth);
			} catch {
				// ignore
			}
		};

		const opts: AddEventListenerOptions = { capture: true, passive: false };
		window.addEventListener('wheel', handleGlobalWheelCapture, opts);
		return () => window.removeEventListener('wheel', handleGlobalWheelCapture, true);
	}, []);

	if (!pdfSelection.isVisible || !pdfSelection.selectedElement) {
		return null;
	}

	const position = getControlsPosition(pdfSelection.selectedElement, viewport);
	const isVisible = isControlsVisible(position);
	if (!isVisible) {
		return null;
	}

	const { currentPage, totalPages } = pdfSelection;

	return (
		<div 
			ref={containerRef}
			className={styles.navigationControls}
			style={{
				left: `${position.left}px`,
				top: `${position.top}px`,
				transform: position.transform,
				transformOrigin: position.transformOrigin,
				zIndex: position.zIndex,
				pointerEvents: 'none'
			}}
			data-testid="pdf-navigation-controls"
		>
			<button
				ref={prevBtnRef}
				className={`${styles.controlButton} ${styles.prevButton}`}
				onClick={goToPrevPage}
				disabled={!canNavigatePrev || isNavigating}
				title={canNavigatePrev ? `Go to page ${currentPage - 1}` : 'First page'}
				aria-label={`Previous page (${currentPage - 1})`}
				data-testid="pdf-prev-button"
				style={{ pointerEvents: 'auto' }}
			/>
			
			<span 
				className={styles.pageInfo}
				title={`Page ${currentPage} of ${totalPages}${isNavigating ? ' - Loading...' : ''}`}
				data-testid="pdf-page-info"
			>
				{isNavigating ? '...' : `${currentPage}/${totalPages}`}
			</span>
			
			<button
				ref={nextBtnRef}
				className={`${styles.controlButton} ${styles.nextButton}`}
				onClick={goToNextPage}
				disabled={!canNavigateNext || isNavigating}
				title={canNavigateNext ? `Go to page ${currentPage + 1}` : 'Last page'}
				aria-label={`Next page (${currentPage + 1})`}
				data-testid="pdf-next-button"
				style={{ pointerEvents: 'auto' }}
			/>
		</div>
	);
};

export default PDFNavigationControls;