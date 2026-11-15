import { createContext, useContext } from "react";

/** False in a kitchen without children: kid tags, age ranges and the "Who" pickers are hidden. */
export const KidsContext = createContext(true);
export const useKids = () => useContext(KidsContext);
