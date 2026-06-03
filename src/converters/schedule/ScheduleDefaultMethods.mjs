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
    },
    {
        name: 'nearPoint',
        requiresCapabilities: [ 'basicLookup' ],
        spatialEngine: true,
        sqlTemplate: 'SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL',
        params: {
            lat:          { type: 'number',  required: true,  description: 'Center latitude (WGS84)' },
            lon:          { type: 'number',  required: true,  description: 'Center longitude (WGS84)' },
            radiusMeters: { type: 'number',  required: true,  description: 'Search radius in METERS' },
            limit:        { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    stop_id:   { type: 'string' },
                    stop_name: { type: 'string' },
                    stop_lat:  { type: 'number' },
                    stop_lon:  { type: 'number' },
                    distanceM: { type: 'number' }
                }
            }
        }
    },
    {
        name: 'inBoundingBox',
        requiresCapabilities: [ 'basicLookup' ],
        spatialEngine: true,
        sqlTemplate: 'SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL',
        params: {
            minLon: { type: 'number',  required: true,  description: 'West bound (WGS84 longitude)' },
            minLat: { type: 'number',  required: true,  description: 'South bound (WGS84 latitude)' },
            maxLon: { type: 'number',  required: true,  description: 'East bound (WGS84 longitude)' },
            maxLat: { type: 'number',  required: true,  description: 'North bound (WGS84 latitude)' },
            limit:  { type: 'integer', required: false, default: 100, description: 'Max results' }
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


    static nearPoint( { db, lat, lon, radiusMeters, limit = 50 } ) {
        const { status, messages } = ScheduleDefaultMethods.#validationNearPoint( { db, lat, lon, radiusMeters } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const rows = db
            .prepare( 'SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL' )
            .all()
        const stops = rows
            .map( ( row ) => {
                const distanceM = ScheduleDefaultMethods.#haversineKm( {
                    lat1: lat, lon1: lon, lat2: row.stop_lat, lon2: row.stop_lon
                } ) * 1000
                return { row, distanceM }
            } )
            .filter( ( entry ) => entry.distanceM <= radiusMeters )
            .sort( ( a, b ) => a.distanceM - b.distanceM )
            .slice( 0, limit )
            .map( ( entry ) => {
                return {
                    stop_id:   entry.row.stop_id,
                    stop_name: entry.row.stop_name,
                    stop_lat:  entry.row.stop_lat,
                    stop_lon:  entry.row.stop_lon,
                    distanceM: Math.round( entry.distanceM * 10 ) / 10
                }
            } )
        return { stops, matchCount: stops.length }
    }


    static inBoundingBox( { db, minLon, minLat, maxLon, maxLat, limit = 100 } ) {
        const { status, messages } = ScheduleDefaultMethods.#validationInBoundingBox( { db, minLon, minLat, maxLon, maxLat } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const rows = db
            .prepare( 'SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL' )
            .all()
        const stops = rows
            .filter( ( row ) => {
                return row.stop_lon >= minLon
                    && row.stop_lon <= maxLon
                    && row.stop_lat >= minLat
                    && row.stop_lat <= maxLat
            } )
            .slice( 0, limit )
            .map( ( row ) => {
                return {
                    stop_id:   row.stop_id,
                    stop_name: row.stop_name,
                    stop_lat:  row.stop_lat,
                    stop_lon:  row.stop_lon
                }
            } )
        return { stops, matchCount: stops.length }
    }


    static #validationNearPoint( { db, lat, lon, radiusMeters } ) {
        const struct = { status: false, messages: [] }
        if( db === undefined || db === null ) {
            struct.messages.push( 'db is required' )
            return struct
        }
        const fields = [
            [ 'lat',          lat ],
            [ 'lon',          lon ],
            [ 'radiusMeters', radiusMeters ]
        ]
        fields
            .forEach( ( [ key, value ] ) => {
                if( value === undefined || value === null ) {
                    struct.messages.push( `${key} is required` )
                    return
                }
                if( typeof value !== 'number' || Number.isNaN( value ) ) {
                    struct.messages.push( `${key} must be a number` )
                }
            } )
        if( struct.messages.length === 0 ) { struct.status = true }
        return struct
    }


    static #validationInBoundingBox( { db, minLon, minLat, maxLon, maxLat } ) {
        const struct = { status: false, messages: [] }
        if( db === undefined || db === null ) {
            struct.messages.push( 'db is required' )
            return struct
        }
        const fields = [
            [ 'minLon', minLon ],
            [ 'minLat', minLat ],
            [ 'maxLon', maxLon ],
            [ 'maxLat', maxLat ]
        ]
        fields
            .forEach( ( [ key, value ] ) => {
                if( value === undefined || value === null ) {
                    struct.messages.push( `${key} is required` )
                    return
                }
                if( typeof value !== 'number' || Number.isNaN( value ) ) {
                    struct.messages.push( `${key} must be a number` )
                }
            } )
        if( struct.messages.length === 0 ) { struct.status = true }
        return struct
    }


    static #haversineKm( { lat1, lon1, lat2, lon2 } ) {
        const toRad = ( deg ) => deg * Math.PI / 180
        const R = 6371
        const dLat = toRad( lat2 - lat1 )
        const dLon = toRad( lon2 - lon1 )
        const a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
            Math.cos( toRad( lat1 ) ) * Math.cos( toRad( lat2 ) ) *
            Math.sin( dLon / 2 ) * Math.sin( dLon / 2 )
        const c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) )
        return R * c
    }
}
