export interface Account {
    siteName: string
    siteLink?: string
    id: string
    pw: string
    tags: string[]
    modifiedAt: string
    createdAt: string
}

export interface AcFile {
    filename: string | null
    pincode: string | null
    tags: string[]
    list: Account[]
}
