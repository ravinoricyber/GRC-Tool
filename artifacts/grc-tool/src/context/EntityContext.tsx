import React, { createContext, useContext, useState, ReactNode } from 'react';

type EntityContextType = {
  activeEntity: string;
  setActiveEntity: (entityCode: string) => void;
};

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export const EntityProvider = ({ children }: { children: ReactNode }) => {
  // Default to Gopuff as per instructions
  const [activeEntity, setActiveEntity] = useState('gopuff');

  return (
    <EntityContext.Provider value={{ activeEntity, setActiveEntity }}>
      {children}
    </EntityContext.Provider>
  );
};

export const useEntity = () => {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
};
