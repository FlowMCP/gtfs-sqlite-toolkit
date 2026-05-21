export class ScheduleCapabilityDetector {
    static detect( { parsedFiles } ) {
        const names = new Set( parsedFiles.keys() )
        const has = ( file ) => names.has( file )
        const hasField = ( file, field ) => {
            if( !names.has( file ) ) return false
            const parsed = parsedFiles.get( file )
            return ( parsed.headers || [] ).includes( field )
        }
        const hasNonEmpty = ( file ) => {
            if( !names.has( file ) ) return false
            const parsed = parsedFiles.get( file )
            return ( parsed.rows || [] ).length > 0
        }

        return {
            basicLookup:         has( 'agency.txt' ) && has( 'stops.txt' ) && has( 'routes.txt' ),
            routing:             has( 'trips.txt' ) && has( 'stop_times.txt' ),
            departures:          has( 'stop_times.txt' ) && ( has( 'calendar.txt' ) || has( 'calendar_dates.txt' ) ),
            shapesVisualization: has( 'shapes.txt' ),
            continuousBoarding:  hasField( 'routes.txt', 'continuous_pickup' ) || hasField( 'routes.txt', 'continuous_drop_off' ) || hasField( 'stop_times.txt', 'continuous_pickup' ) || hasField( 'stop_times.txt', 'continuous_drop_off' ),
            stationNavigation:   has( 'pathways.txt' ) && has( 'levels.txt' ),
            fareCalculationV2:   has( 'fare_leg_rules.txt' ) || has( 'fare_products.txt' ),
            fareTransfers:       has( 'fare_transfer_rules.txt' ),
            flexService:         has( 'booking_rules.txt' ) || has( 'locations.geojson' ) || has( 'location_groups.txt' ),
            frequencyBased:      has( 'frequencies.txt' ),
            multilingual:        has( 'translations.txt' ),
            licensedAttribution: hasNonEmpty( 'attributions.txt' )
        }
    }
}
