export interface Account {
    id: string
    pw: string
    address: string
    modifiedAt: string
    createdAt: string
}

export interface AcFile {
    filename: string | null
    pincode: string | null
    list: Account[]
}
