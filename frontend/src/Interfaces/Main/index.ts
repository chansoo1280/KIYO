export const sortType = {
    siteName: "siteName",
    modifiedAt: "modifiedAt",
    copiedAt: "copiedAt",
} as const
export type sortType = typeof sortType[keyof typeof sortType]

export interface Account {
    idx: number
    siteName: string
    siteLink?: string
    id: string
    pw: string
    tags: string[]
    modifiedAt: string
    createdAt: string
    copiedAt: string
}

export interface AcFile {
    filename: string | null
    pincode: string | null
    tags: string[]
    list: Account[]
    sortType: sortType
}
