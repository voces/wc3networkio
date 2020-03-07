# networkio
networkio is a protocol for WC3 maps to make network requests with aid of a proxy.

## Overview
networkio works by having the map write requests to a directory monitored by a
proxy service. When the proxy detects a file being created or updated, the
proxy will parse the contents (JSON), create a request, then write the response
body (no headers) to multiple files. The map, in the meantime, will poll for
these files, and when the map detects one, it will load in the contents. Once
done, the map will modify the original request file in order to have the proxy
delete it and the response files.

## Proxy
The proxy's job is to monitor for requests, make the request, write the
response, and clean up files.

### Watching
The proxy will monitor for files being created or updated in the
`%DOCUMENTS%/Warcraft III/CustomMapData/networkio` directory. Because of the
constraints of writing files from WC3, there will be some Preloader calls
wrapping the actual request:
```
function PreloadFiles takes nothing returns nothing

    call PreloadStart()
    call Preload( "{ "url": "proxy://version" }" )
    call PreloadEnd( 0.0 )

endfunction
```
This actual contents will exist between the first quote (`"`) and last quote.
The contents will be valid JSON with the following structure:
```typescript
{
	url: string,
	headers?: Record<string, string>,
	body?: string
}
```
### Making a request
Requests where the `url`'s protocol is equal to `"proxy"` signify special
requests to be performed by the proxy itself. Otherwise, it should perform the
actual network request.

### Writing a response
Onec the proxy has the response content, it should write the response to disk
to be consumed by the map. The responses will be written to the request file's
path, replacing `"requests"` with `"responses"`. Further, because WC3 maps can
only preload a single path once, we will write ten files, each with a numeric
tag, ranging from 0 to 9. This tag comes at the end of the filename before the
file extension.

Example:
```typescript
const request = "networkio/requests/7.txt";
const response0 = "networkio/requests/7-0.txt";
const response1 = "networkio/requests/7-1.txt";
// ...
const response1 = "networkio/requests/7-9.txt";
```

Each response must be wrapped in Preload natives. networkio is to be configured
with the same loading mechanism as
[FileIO](https://www.hiveworkshop.com/threads/fileio.307568/). This means we'll
chunk data into 200-character blocks, wrapping them in `BlzSetAbilityIcon` calls:
```
function PreloadFile takes nothing returns nothing
        call BlzSetAbilityIcon(1097690227, "-{\"status\":\"OK\",\"code\":200,\"queryTime\":0.0028,\"body\":[{\"name\":\"f\",\"server\":\"usw\",\"map\":\"Custom_Castle_Defense_v7.17.0p.w3x\",\"host\":\"Daks#1452\",\"details\":null,\"slotsTaken\":")
        call BlzSetAbilityIcon(1098018659, "-2,\"slotsTotal\":12,\"created\":1583607854,\"checksum\":\"\",\"lastUpdated\":1583607888,\"id\":52389}]}")
endfunction
```
The first argument of `BlzSetAbilityIcon` is the ability ID. We use ten in the
following order:
```typescript
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
```
This means the proxy can at max respond with 2000 characters of data. If the
response is larger than 2000 characters, the proxy should simply return `null`.

The second argument of `BlzSetAbilityIcon` is the 200-character chunked data,
prefixed with a `"-"`. Note that the string should be JASS-escaped (replace
`\` characters with `\\` and `"` characters with `\\"`).

### Special requests
There are two special requests that exist: `clear` and `version`.

#### Clear
When the request `url` is equal to `"proxy://clear"`, then the proxy should
simply delete the request file and any possible response files.

This functionality is neccessary to prevent a map from loading the response of
a previous map's request.

#### Version
When the request `url` is equal to `"proxy://version"`, then the proxy should
respond with contents of the numerical version of this spec in the format
specified in Writing a response. The current version of the spec is `1`.

The is used at the very beginning of map loading to determine which players
have the proxy and to future-proof compatibility with spec modifications.

## Map
TODO