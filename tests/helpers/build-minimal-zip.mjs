import { buildZipBuffer } from './zip-builder.mjs'


export const buildMinimalValidZip = async () => {
    return await buildZipBuffer( { entries: [
        [ 'agency.txt',     'agency_id,agency_name,agency_url,agency_timezone\nDB,Deutsche Bahn,https://bahn.de,Europe/Berlin' ],
        [ 'stops.txt',      'stop_id,stop_name,stop_lat,stop_lon\nS1,Hauptbahnhof,48.4011,9.9876\nS2,Marktplatz,48.4014,9.9912' ],
        [ 'routes.txt',     'route_id,agency_id,route_short_name,route_long_name,route_type\nR1,DB,ICE 100,Hamburg-Ulm,2\nR2,DB,RB 51,Ulm-Sigmaringen,2' ],
        [ 'trips.txt',      'trip_id,route_id,service_id\nT1,R1,WORKDAY\nT2,R2,WORKDAY' ],
        [ 'stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,S1,1\nT1,08:10:00,08:10:00,S2,2\nT2,09:00:00,09:00:00,S1,1' ],
        [ 'calendar.txt',   'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWORKDAY,1,1,1,1,1,0,0,20260101,20261231' ]
    ] } )
}


export const buildBrokenFkZip = async () => {
    return await buildZipBuffer( { entries: [
        [ 'agency.txt',     'agency_id,agency_name,agency_url,agency_timezone\nDB,Deutsche Bahn,https://bahn.de,Europe/Berlin' ],
        [ 'stops.txt',      'stop_id,stop_name,stop_lat,stop_lon\nS1,Hauptbahnhof,48.4011,9.9876' ],
        [ 'routes.txt',     'route_id,agency_id,route_short_name,route_long_name,route_type\nR1,DB,ICE,Hamburg-Ulm,2' ],
        [ 'trips.txt',      'trip_id,route_id,service_id\nT1,R-DOES-NOT-EXIST,WORKDAY' ],
        [ 'stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,S1,1' ],
        [ 'calendar.txt',   'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWORKDAY,1,1,1,1,1,0,0,20260101,20261231' ]
    ] } )
}


export const buildMissingRequiredZip = async () => {
    return await buildZipBuffer( { entries: [
        [ 'stops.txt', 'stop_id,stop_name\nS1,Foo' ]
        // missing agency.txt, routes.txt, trips.txt, stop_times.txt
    ] } )
}


export const buildFlexZip = async () => {
    return await buildZipBuffer( { entries: [
        [ 'agency.txt',        'agency_id,agency_name,agency_url,agency_timezone\nDB,Deutsche Bahn,https://bahn.de,Europe/Berlin' ],
        [ 'stops.txt',         'stop_id,stop_name,stop_lat,stop_lon\nS1,Hauptbahnhof,48.4011,9.9876' ],
        [ 'routes.txt',        'route_id,agency_id,route_short_name,route_long_name,route_type\nR1,DB,Flex,On-Demand,2' ],
        [ 'trips.txt',         'trip_id,route_id,service_id\nT1,R1,WORKDAY' ],
        [ 'stop_times.txt',    'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,S1,1' ],
        [ 'calendar.txt',      'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWORKDAY,1,1,1,1,1,0,0,20260101,20261231' ],
        [ 'booking_rules.txt', 'booking_rule_id,booking_type\nBR1,1' ]
    ] } )
}
