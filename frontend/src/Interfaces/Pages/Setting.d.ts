// #region Global Imports
// #endregion Global Imports

import { Category } from "@Interfaces/Main"

declare namespace ISettingPage {
    export interface InitialProps {
        layout?: number
        transition: string
    }

    export interface IStateProps {
        info: {
            version: number
        }
        image: {
            url: string
        }
    }

    namespace Actions {
        export interface IMapPayload {}

        export interface IMapResponse {}

        export interface IGetApodPayload extends PlanetaryModel.GetApodPayload {
            params: {}
        }

        export type IGetApodResponse = PlanetaryModel.GetApodResponse
    }
}

export { ISettingPage }
