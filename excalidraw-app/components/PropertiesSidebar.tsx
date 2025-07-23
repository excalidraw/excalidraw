import React, { useState, useEffect } from 'react';
import type { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/types';

interface PropertiesSidebarProps {
  element: NonDeletedExcalidrawElement | null;
  onUpdate: (data: any) => void;
}

const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({ element, onUpdate }) => {
  const [isCard, setIsCard] = useState(false);
  const [isZone, setIsZone] = useState(false);
  const [acceptedCardIds, setAcceptedCardIds] = useState('');

  useEffect(() => {
    if (element?.customData) {
      setIsCard(!!element.customData.isCard);
      setIsZone(!!element.customData.isZone);
      setAcceptedCardIds(element.customData.acceptedCardIds || '');
    } else {
      setIsCard(false);
      setIsZone(false);
      setAcceptedCardIds('');
    }
  }, [element]);

  const handleUpdate = () => {
    onUpdate({
      isCard,
      isZone,
      acceptedCardIds,
    });
  };

  if (!element) {
    return null;
  }

  return (
    <div style={{ background: '#fff', padding: '1rem', width: '250px' }}>
      <h3>Element Properties</h3>
      <div>
        <label>
          <input
            type="checkbox"
            checked={isCard}
            onChange={(e) => setIsCard(e.target.checked)}
          />
          Is Card
        </label>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={isZone}
            onChange={(e) => setIsZone(e.target.checked)}
          />
          Is Zone
        </label>
      </div>
      {isZone && (
        <div>
          <label>
            Accepted Card IDs (comma-separated):
            <input
              type="text"
              value={acceptedCardIds}
              onChange={(e) => setAcceptedCardIds(e.target.value)}
            />
          </label>
        </div>
      )}
      <button onClick={handleUpdate}>Update</button>
    </div>
  );
};

export { PropertiesSidebar };