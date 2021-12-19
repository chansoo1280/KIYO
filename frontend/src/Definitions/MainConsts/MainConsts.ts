import { Account, AcFile, RNFile } from "@Interfaces"

export const RN_API = {
    GET_VERSION: "GET_VERSION",
    SET_DIR: "SET_DIR",
    SET_COPY: "SET_COPY",
    SET_SEL_FILENAME: "SET_SEL_FILENAME",
    SET_FILENAME: "SET_FILENAME",
    GET_FILENAME: "GET_FILENAME",
    GET_FILE: "GET_FILE",
    SHARE_FILE: "SHARE_FILE",
    BACKUP_FILE: "BACKUP_FILE",
    GET_FILE_LIST: "GET_FILE_LIST",
    CREATE_FILE: "CREATE_FILE",
    SET_FILE: "SET_FILE",
    DELETE_FILE: "DELETE_FILE",
    SET_PINCODE: "SET_PINCODE",
    SET_SORTTYPE: "SET_SORTTYPE",
} as const
export type RN_API = typeof RN_API[keyof typeof RN_API]

export type RN_API_REQ_TYPES = {
    [RN_API.GET_VERSION]: unknown
    [RN_API.SET_DIR]: {
        dirpath: string
        list: RNFile[]
    }
    [RN_API.SET_COPY]: {
        text: string
    }
    [RN_API.SET_SEL_FILENAME]: {
        filepath: string
    }
    [RN_API.SET_FILENAME]: {
        myFilename: AcFile["filename"]
        pincode: AcFile["pincode"]
    }
    [RN_API.GET_FILENAME]: string | false
    [RN_API.GET_FILE]: unknown
    [RN_API.SHARE_FILE]: unknown
    [RN_API.BACKUP_FILE]: {
        filename: AcFile["filename"]
        pincode: AcFile["pincode"]
    }
    [RN_API.GET_FILE_LIST]: {
        dirpath: string
        list: RNFile[]
    }
    [RN_API.CREATE_FILE]: {
        pincode: AcFile["pincode"]
        filename: AcFile["filename"]
        list: []
    }
    [RN_API.SET_FILE]: {
        list: Partial<Account>[]
        pincode: AcFile["pincode"]
    }
    [RN_API.DELETE_FILE]: {
        filepath: string
    }
    [RN_API.SET_PINCODE]: {
        newPincode: AcFile["pincode"]
        pincode: AcFile["pincode"]
    }
    [RN_API.SET_SORTTYPE]: {
        sortType: AcFile["sortType"]
    }
}
export type RN_API_RES_TYPES = {
    [RN_API.GET_VERSION]: string
    [RN_API.SET_DIR]: {
        dirpath: string
        list: RNFile[]
    }
    [RN_API.SET_COPY]: boolean
    [RN_API.SET_SEL_FILENAME]: boolean
    [RN_API.SET_FILENAME]: false | string
    [RN_API.GET_FILENAME]: string | false
    [RN_API.GET_FILE]: false | AcFile
    [RN_API.SHARE_FILE]: unknown
    [RN_API.BACKUP_FILE]: boolean
    [RN_API.GET_FILE_LIST]: {
        dirpath: string
        list: RNFile[]
    }
    [RN_API.CREATE_FILE]: false | AcFile
    [RN_API.SET_FILE]: false | Account[]
    [RN_API.DELETE_FILE]: boolean
    [RN_API.SET_PINCODE]: false | AcFile["pincode"]
    [RN_API.SET_SORTTYPE]: boolean
}
