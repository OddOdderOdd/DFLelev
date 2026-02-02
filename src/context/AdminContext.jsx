// src/context/AdminContext.jsx
import React, { createContext, useContext, useState } from 'react';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);

  const toggleAdmin = () => {
    setIsAdmin((prev) => !prev);
    // Reset text editing when leaving admin mode
    if (isAdmin) {
      setIsEditingText(false);
    }
  };

  const toggleTextEdit = () => {
    setIsEditingText((prev) => !prev);
  };

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        isEditingText,
        toggleAdmin,
        toggleTextEdit,
        setIsEditingText,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};
