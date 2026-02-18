import React from 'react';
import MindmapCanvas from '../components/Mindmap/MindmapCanvas';

export default function Mindmap() {
  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <MindmapCanvas />
    </div>
  );
}
