// #region Global Imports
// #endregion Global Imports

import { Category } from "@Interfaces/Main"

declare namespace IInfoPage {
    export interface InitialProps {
        layout?: number
        cate_info?: Category
        nav_info?: {
            next?: Category | null
            prev?: Category | null
        } | null
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

        export interface IGetApodResponse extends PlanetaryModel.GetApodResponse {}
    }
}

export { IInfoPage }
