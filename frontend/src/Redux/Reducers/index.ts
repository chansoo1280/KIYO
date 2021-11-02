// #region Global Imports
import { combineReducers } from "redux"
// #endregion Global Imports

// #region Local Imports
import appReducer from "./app"
import acFileReducer from "./acFile"
// #endregion Local Imports

export * from "./app"
export * from "./acFile"

const rootReducer = combineReducers({
    appReducer,
    acFileReducer,
})

export default rootReducer

export type RootState = ReturnType<typeof rootReducer>
