import Logger from "../utilities/logger";
import MongoClient from "./mongo-client"
import NedbClient from "./nedb-client"

export default function getDbClient(connectionString: string): IDbClient
{
    const protocol = connectionString.match(/^.+:\/\//)![0]

    if (protocol)
    {
        Logger.consoleLog(`Using database protocol ${protocol}`)
        switch (protocol)
        {
            case "mongodb://":
                return new MongoClient(connectionString)
            case "nedb://":
                return new NedbClient(connectionString)
        }
    }

    throw new Error("Invalid connection string")
}

export interface IDbClient
{
    updateOne(collectionName: string, query: any, update: any, allowBuffering?: boolean): Promise<void>
    insertOne(collectionName: string, record: any, allowBuffering?: boolean): Promise<void>
    findOne(collectionName: string, query: any, allowBuffering?: boolean): Promise<any>
    deleteOne(collectionName: string, query: any, allowBuffering?: boolean): Promise<void>
    isMongo: boolean
}