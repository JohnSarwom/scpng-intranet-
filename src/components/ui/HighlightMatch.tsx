import React from 'react';

interface HighlightMatchProps {
  text: string | null | undefined;
  searchTerm: string | null | undefined;
  className?: string; // Allow passing additional class names
}

const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, searchTerm, className }) => {
  const stringText = String(text || '');
  const stringSearchTerm = String(searchTerm || '');

  if (!stringSearchTerm || !stringText) {
    return <span className={className}>{stringText || 'N/A'}</span>;
  }

  const lowerText = stringText.toLowerCase();
  const lowerSearchTerm = stringSearchTerm.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  while (lastIndex < stringText.length) {
    const index = lowerText.indexOf(lowerSearchTerm, lastIndex);

    if (index === -1) {
      parts.push(<span key={lastIndex}>{stringText.substring(lastIndex)}</span>);
      break; // No more matches
    }

    // Add the part before the match
    if (index > lastIndex) {
      parts.push(<span key={`pre-${lastIndex}`}>{stringText.substring(lastIndex, index)}</span>);
    }

    // Add the highlighted match
    const match = stringText.substring(index, index + stringSearchTerm.length);
    parts.push(
      <span key={index} className="bg-yellow-200 font-semibold">
        {match}
      </span>
    );

    lastIndex = index + searchTerm.length;
  }

  return <span className={className}>{parts}</span>;
};

export default HighlightMatch; 