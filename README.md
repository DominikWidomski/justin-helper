# justin-helper
CLI tool for justin, ultimately to be automated and plug into slack.


## TODO:

- [ ] continuous process, not just one entry at a time.
- [ ] Sometimes projects change. What if it's no longer active? Won't be in the projects thing I receive or it's attribute?
	- [ ] Show that the project has ended (API doesn't prevent submission)
	- [ ] Filter out ended projects from the autocomplete search
- [ ] error handling for submitting to project failing - show error
- [ ] getting project name - is this about relating records together in client, could give that a go.
- [ ] Add flow definitions
- [ ] rename the auth token file to `.justinconfig` or `.justinrc` or something.
- [ ] Allow loggin in from terminal using `-u` and `-p` flags like in SSH i guess or elsewhere (this probably wouldn't modify the `.env` file... ?)
- [ ] Use this for projects select: https://github.com/mokkabonna/inquirer-autocomplete-prompt
- [ ] There's a date plugin for date select
- [ ] Indicate Authenticating, show email, maybe progress and success ✅
- [ ] Automated testing!
- [ ] `-i` flag, for actually asking prompts, otherwise autorun the whole thing to repeat next day.
- [ ] `-e` flag to interactively only edit the next entry, run everything as otherwise expected.
- [ ] Default to 7h for day, and to remainder of the time if multiple projects in day.


---


# Notes:


## Custom Prompt:

/Users/dddom/Dev/dominikwidomski/justin-bot/node_modules/inquirer/lib/utils/screen-manager.js
/Users/dddom/Dev/dominikwidomski/justin-bot/node_modules/inquirer/lib/prompts/base.js

## Justin API: 

get bracket pair colorizer or similar?!!?!?

// API Routing here: https://github.com/digital-detox/justin/blob/develop/routes/api.php

// Application key [base64:x2XDG5UDYUMhnPYXjokBtBr+yrI192KGHxqdW8o4r1g=] set successfully.
// 
// API access token for "dom-justin-bot" successfully created.
const app_token = 'PWLbKIOgKLgw1rshQFuJyhKnd3PJrQ8G85MGrNsc';

/**
 * IGNORE
async function cryptoMess() {
	// const hmac = crypto.createHmac('sha256', token);
	// const header = {
	// 	"typ": "JWT",
	// 	"alg": "HS256"
	// };
	// const payload = tokenData;
	// const payload = {
	// 	app_token,
	// 	email: process.env.email,
	// 	password: process.env.password
	// }

	// hmac.update(
	// 	base64url(JSON.stringify(header)) + '.' +
	// 	base64url(JSON.stringify(payload))
	// );

	// const secret = hmac.digest('hex');

	// const auth = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.${secret}`;
	// const auth = jwt.sign(payload, app_token);
	// console.log('BEARER: ', auth);

	// eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTAwODQzNDQsImV4cCI6MTUxMTI5Mzk0NCwibmJmIjoxNTEwMDg0MzQ0LCJqdGkiOiI0WkcxZEpSbTNZVmRCdHVzIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.3-oZ1rezXXW6mecQO0WETnbV1Gj-LvsCkd_RINIQKTw
	// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEifQ.lLn0dAhm0VYQNoZSqkt3YVRzu3tVhQtFIHtZyzhEDqg=
	// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJlbWFpbCI6ImRvbWluaWtAZGlnaXRhbC1kZXRveC5jby51ayIsImFkbWluIjpmYWxzZX0.pbbvsuvFyY8pHTDtMMIcuxwrF4FVk0UbSwFVDm0GvlM=

	const url = basePath + '/users/' + userId;
	const res = await fetch(url, {
		method: 'GET',
		headers: {
			// 'Authorization': 'Bearer ' + auth, 
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/x-www-form-urlencoded'
		}, 
	});

	console.log(await res.text());
}
 */

curl 'https://api.dev.justinapp.io/v1/project-times' -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":420,"approved_at":null,"created_at":null,"updated_at":null,"is_rejected":false},"type":"project-times"}}' --compressed