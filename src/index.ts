
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

const watchPath = `${os.homedir()}/Documents/Warcraft III/CustomMapData/networkio/requests`;
console.log( new Date(), "watching", watchPath );
watch( watchPath, async ( event, filename ) => {

	if ( event !== "update" ) return;

	console.log( new Date(), "received request", filename );

	const contents = await fs.readFile( filename, { encoding: "utf-8" } );
	const start = contents.indexOf( "\"" ) + 1;
	const end = contents.lastIndexOf( "\"" );
	const json = contents.slice( start, end );
	const request = JSON.parse( json );

	let response = ( await fetch( request.url, {
		method: request.method ?? ( request.body ? "POST" : "GET" ),
		body: request.body,
	} ).then( r => r.text() ) ).replace( /"/g, "\\\"" );

	if ( response.length > preloadLimit * abilities.length ) {

		console.log( new Date(), `response too large (${response.length}), writing empty value` );
		response = "";

	}

	try {

		let content = "function PreloadFiles takes nothing returns nothing\n\ncall PreloadStart()\ncall Preload(\"";

		for ( let abilityIndex = 0, responseIndex = 0; responseIndex < response.length; abilityIndex ++, responseIndex += preloadLimit ) {

			const chunk = response.slice( responseIndex, responseIndex + preloadLimit );
			content += `")\ncall BlzSetAbilityIcon(${abilities[ abilityIndex ]}, "-${chunk}")\n`;

		}

		content += "call PreloadEnd(0.0)\nendfunction";

		const responseFilename = filename.replace( "requests", "responses" );
		await fs.mkdir( path.dirname( responseFilename ), { recursive: true } );
		fs.writeFile( responseFilename, content );
		console.log( new Date(), "writing response", responseFilename );

	} catch ( err ) {

		console.log( err );

	}

} );
