import React from 'react';

// The background is now largely handled by the main layout divs in App.tsx 
// (Beige top, Blue bottom), so we just render a neutral base here just in case.
export const Background: React.FC = () => (
  <div className="fixed inset-0 z-[-1] bg-white" />
);