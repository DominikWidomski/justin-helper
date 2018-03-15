/* @flow */

export type Project = {
    // type: "projects",
    type: string,
    id: string,
    attributes: {
        name: string,
        creator_id: string | null,
        created_at: string,
        updated_at: string,
        organisation_id: string,
        approver_id?: string,
        status_id: string,
        client_id: string | null,
        is_billable: boolean,
        start_date: string | null,
        end_date: string | null,
        budget_mins: number
    }
};

export type ProjectTime = {
    type: string,
    id: string,
    attributes: {
        user_id: string,
        project_id: string,
        date: string,
        duration_mins: number,
        creator_id: string,
        created_at: string,
        updated_at: string,
        approved_at?: string,
        approved_id?: string,
        is_rejected: boolean
    },
    relationships: {
        [key: string]: {
            data: []
        }
    }
};

export type JustinResponse<T> = {
    data: T,
    links: {
        self: string,
        first: string,
        last?: string
    },
    meta: {
        total: number
    }
};