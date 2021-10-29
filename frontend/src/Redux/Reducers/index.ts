// #region Global Imports
import { combineReducers } from "redux"
// #endregion Global Imports

// #region Local Imports
import appReducer from "./app"
import acReducer from "./ac"
// #endregion Local Imports

export * from "./app"
export * from "./ac"

const rootReducer = combineReducers({
    appReducer,
    acReducer,
})

export default rootReducer

export type RootState = ReturnType<typeof rootReducer>
