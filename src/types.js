/* @flow */

export type ProjectTime = {
    id: string,
    attributes: {
        project_id: string,
        date: string,
        duration_mins: number
    }
};

export type JustinResponse<T> = {
    data: T,
    links: {
        self: string,
        first: string,
        // last?: string // ???
    },
    meta: {
        total: number
    }
};