import { createContext, useContext } from 'react';

export const AuthCtx = createContext(null);

/** Current staff session plus login/register/logout helpers. */
export const useAuth = () => useContext(AuthCtx);
