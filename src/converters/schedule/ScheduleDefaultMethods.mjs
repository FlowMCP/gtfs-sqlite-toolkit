const METHOD_CATALOG = [
    {
        name: 'searchStops',
        requiresCapabilities: [ 'basicLookup' ],
        sqlTemplate: 'SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops_fts WHERE stops_fts MATCH :query LIMIT :limit',
        params: {
            query: { type: 'string', required: true, description: 'FTS5 MATCH query string' },
            limit: { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    stop_id:   { type: 'string' },
                    stop_name: { type: 'string' },
                    stop_lat:  { type: 'number' },
                    stop_lon:  { type: 'number' }
                }
            }
        }
    },
    {
        name: 'searchRoutes',
        requiresCapabilities: [ 'basicLookup' ],
        sqlTemplate: 'SELECT route_id, route_short_name, route_long_name, route_type FROM routes WHERE route_short_name = :name OR route_long_name = :name LIMIT :limit',
        params: {
            name:  { type: 'string', required: true, description: 'route_short_name or route_long_name' },
            limit: { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    route_id:         { type: 'string' },
                    route_short_name: { type: 'string' },
                    route_long_name:  { type: 'string' },
                    route_type:       { type: 'integer' }
                }
            }
        }
    },
    {
        name: 'getDepartures',
        requiresCapabilities: [ 'departures' ],
        sqlTemplate: `SELECT t.trip_id, t.route_id, r.route_short_name, st.stop_id, st.departure_time
                      FROM stop_times st
                      JOIN trips t ON st.trip_id = t.trip_id
                      JOIN routes r ON t.route_id = r.route_id
                      WHERE st.stop_id = :stop_id AND st.departure_time >= :from_time
                      ORDER BY st.departure_time ASC LIMIT :limit`,
        params: {
            stop_id:   { type: 'string', required: true },
            from_time: { type: 'string', required: true, description: 'HH:MM:SS' },
            limit:     { type: 'integer', required: false, default: 20 }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    trip_id:          { type: 'string' },
                    route_id:         { type: 'string' },
                    route_short_name: { type: 'string' },
                    stop_id:          { type: 'string' },
                    departure_time:   { type: 'string' }
                }
            }
        }
    },
    {
        name: 'getShapeForRoute',
        requiresCapabilities: [ 'shapesVisualization', 'routing' ],
        sqlTemplate: `SELECT DISTINCT s.shape_id, s.shape_pt_lat, s.shape_pt_lon, s.shape_pt_sequence
                      FROM shapes s
                      JOIN trips t ON s.shape_id = t.shape_id
                      WHERE t.route_id = :route_id
                      ORDER BY s.shape_id, s.shape_pt_sequence ASC`,
        params: {
            route_id: { type: 'string', required: true }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    shape_id:          { type: 'string' },
                    shape_pt_lat:      { type: 'number' },
                    shape_pt_lon:      { type: 'number' },
                    shape_pt_sequence: { type: 'integer' }
                }
            }
        }
    },
    {
        name: 'getFlexBookingRules',
        requiresCapabilities: [ 'flexService' ],
        sqlTemplate: 'SELECT * FROM booking_rules WHERE booking_rule_id = :booking_rule_id',
        params: {
            booking_rule_id: { type: 'string', required: true }
        },
        outputSchema: {
            type: 'object',
            description: 'booking_rules row, schema depends on which optional fields are present'
        }
    }
]


export class ScheduleDefaultMethods {
    static getAllMethods() {
        return METHOD_CATALOG.map( ( m ) => ( { ...m } ) )
    }


    static getMethodsForCapabilities( { capabilities } ) {
        return METHOD_CATALOG.filter( ( method ) => {
            return method.requiresCapabilities.every( ( cap ) => capabilities[ cap ] === true )
        } ).map( ( m ) => ( { ...m } ) )
    }


    static getMethodByName( { name } ) {
        const method = METHOD_CATALOG.find( ( m ) => m.name === name )
        if( !method ) {
            throw new Error( `Unknown method: ${name}` )
        }
        return { ...method }
    }
}
