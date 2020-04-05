
import watch from "node-watch";
import os from "os";
import { promises as fs } from "fs";
import fetch from "node-fetch";
import path from "path";

const preloadLimit = 200;
const abilities = [
	1097690227,
	1098018659,
	1097689443,
	1097689452,
	1097034854,
	1097035111,
	1097098598,
	1097099635,
	1097228916,
	1097228907,
];

const watchPath = path.join( os.homedir(), "Documents", "Warcraft III", "CustomMapData", "networkio", "requests" );
console.log( new Date(), "watching", watchPath );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeRequest = async ( request: any ): Promise<string> => {

	if ( request.url === "proxy://version" )
		return "2";

	return ( await fetch( request.url, {
		method: request.method ?? ( request.body ? "POST" : "GET" ),
		body: request.body,
	} ).then( r => r.text() ) )
		.replace( /\\/g, "\\\\" )
		.replace( /\r?\n/g, "\\n" )
		.replace( /"/g, "\\\"" );

};

watch( watchPath, async ( event, filename ) => {

	try {

		if ( event !== "update" ) return;

		const contents = await fs.readFile( filename, { encoding: "utf-8" } );
		const responseFilename = filename.replace( "requests", "responses" );
		const start = contents.indexOf( "\"" ) + 1;
		const end = contents.lastIndexOf( "\"" );
		const json = contents.slice( start, end );
		const request = JSON.parse( json );

		if ( request.url === "proxy://clear" ) {

			console.log( new Date(), "clearing request", filename );
			fs.unlink( filename );
			Promise.all( Array( 10 ).fill( 0 ).map( ( _, i ) => fs.unlink( responseFilename.replace( ".txt", `-${i}.txt` ) ) ) );
			return;

		}

		console.log( new Date(), "received request", filename );
		console.log( request );

		let response = await makeRequest( request );

		if ( response.length > preloadLimit * abilities.length ) {

			console.log( new Date(), `response too large (${response.length}), writing empty value` );
			response = "";

		}

		if ( request.noResponse ) {

			console.log( new Date(), "no response, clearing request", filename );
			fs.unlink( filename );
			return;

		}

		console.log( new Date(), "writing response", responseFilename );
		console.log( response );

		let content = "function PreloadFiles takes nothing returns nothing";

		for ( let abilityIndex = 0, responseIndex = 0; responseIndex < response.length; abilityIndex ++, responseIndex += preloadLimit ) {

			const chunk = response.slice( responseIndex, responseIndex + preloadLimit );
			content += `\n\tcall BlzSetAbilityIcon(${abilities[ abilityIndex ]}, "-${chunk}")`;

		}

		content += "\nendfunction";

		await fs.mkdir( path.dirname( responseFilename ), { recursive: true } );
		await Promise.all( Array( 10 ).fill( 0 ).map( ( _, i ) => fs.writeFile( responseFilename.replace( ".txt", `-${i}.txt` ), content ) ) );

	} catch ( err ) {

		console.error( new Date(), err );

	}

} );
