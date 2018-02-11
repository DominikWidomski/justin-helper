/* @flow */

export type ProjectTime = {
    id: string,
    attributes: {
        project_id: string,
        date: string,
        duration_mins: number
    }
};
