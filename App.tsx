import React from 'react';
import AsteroidsGame from './components/AsteroidsGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      <AsteroidsGame />
    </div>
  );
};

export default App;
