
// tslint:disable: no-invalid-this


declare var process: any;

const apiKey: string = process.env[ "phantomjscloud_apikey" ];
//const apiKey = environment.getEnvironmentVariable( "phantomjscloud_apikey" );
const endpointOrigin: string =
	//	"http://localhost:80"; //used for UAT testing
	//"https://phantomjscloud.com"; //PROD (explicit)
	//"http://35.232.215.225"; //PREPROD
	undefined; //PROD (implicit, default)

import phantomjscloud = require( "./_index" );
import ioDatatypes = phantomjscloud.ioDatatypes;
import log = require( "./xlib-micro/log-helper" );
//log.logLevel = log.LOGLEVEL.DEBUG;
import _ = require( "lodash" );
import reflection = require( "./xlib-micro/reflection" );
import promise = require( "./xlib-micro/promise" );
import axios = require( "axios" );
import stringHelper = require( "./xlib-micro/str-helper" );
import bb = require( "bluebird" );


const __verifyResponseStatus_defaultOptions = { contentStatusCode: 200, userResponseStatusCode: 200, backend: "chrome", doneDetail: "normal", contentType: "" };
/** does basic verification of the userResponse common among most tests */
function verifyResponseStatus( userResponse: ioDatatypes.IUserResponse, options: Partial<typeof __verifyResponseStatus_defaultOptions> = __verifyResponseStatus_defaultOptions ) {

	options = _.defaultsDeep( options, __verifyResponseStatus_defaultOptions );
	const responseSummary = stringHelper.summarize( JSON.stringify( userResponse ), 10000 );// xlib.serialization.jsonX.inspectParse( userResponse );

	log.throwCheck( userResponse != null, "response null", { options, userResponse } );
	log.throwCheck( userResponse.statusCode === options.userResponseStatusCode, "responseStatusCode", userResponse.statusCode, { options, responseSummary } );
	log.throwCheck( userResponse.content.statusCode === options.contentStatusCode, "contentStatusCode", userResponse.content.statusCode, { options, responseSummary } );
	log.throwCheck( userResponse.meta.backend.platform.toLowerCase() === options.backend.toLowerCase(), "backend", userResponse.meta.backend, { options, responseSummary } );
	if ( options.backend === "chrome" ) {
		log.throwCheck( JSON.stringify( userResponse.content.doneDetail ).includes( options.doneDetail ), "doneDetail", userResponse.content.doneDetail, { options, responseSummary } );
	}
	if ( options.contentType != null && options.contentType.length > 0 ) {
		log.throwCheck( userResponse.content.headers[ "content-type" ].includes( options.contentType ), `content-type header not what expected. got ${ userResponse.content.headers[ "content-type" ] } but expect it to include "${ options.contentType }"` );
	}

	log.throwCheck( userResponse.meta.billing.creditCost > 0, "invalid creditCost" );
	log.throwCheck( userResponse.meta.billing.dailySubscriptionCreditsRemaining >= 0, "invalid dailySubscriptionCreditsRemaining" );
	log.throwCheck( userResponse.meta.billing.prepaidCreditsRemaining >= 0, "invalid prepaidCreditsRemaining" );

	_.forEach( userResponse.pageResponses, ( pageResponse ) => {
		//log.throwCheck( pageResponse.metrics.pageStatus === options.contentStatusCode.toString(), "pageResponse.metrics.pageStatus", pageResponse.metrics.pageStatus, { options, pageResponse: JSON.stringify( pageResponse ) } );
		if ( options.backend === "chrome" ) {
			log.throwCheck( JSON.stringify( pageResponse.doneDetail ).includes( options.doneDetail ), "pageResponse.doneDetail", pageResponse.doneDetail, { options, pageResponse: JSON.stringify( pageResponse ) } );
		}
	} );
}
/** helper to set all properties to null */
function _nullAllProperties( obj: any ) {
	_.forEach( obj, ( value, key ) => {
		if ( _.isObject( value ) ) {
			_nullAllProperties( value );
			obj[ key ] = value;
		} else {
			obj[ key ] = null;
		}
	} );
}

/** hack fix for mocha bug, unable to have a timeout for async tests */
function it2( testFcn: () => Promise<any> ) {
	const testName = reflection.getTypeName( testFcn );
	return it( testName, async function () {
		const timeoutMs = this.timeout();
		return bb.resolve( testFcn.apply( this ) ).timeout( timeoutMs, new bb.TimeoutError( `operation timed out.  Max of ${ timeoutMs }ms exceeded` ) );
	} );
}

describe( "phantomjscloud-unit-tests", function unitTests() {

	let browser: phantomjscloud.BrowserApi;

	this.timeout( 10000 ); //set default timeout for these pjsc tests
	this.beforeAll( function beforeAll() {


		browser = new phantomjscloud.BrowserApi( { apiKey, endpointOrigin } );


	} );




	describe( "e2eDefaultBrowser", function e2eDefaultBrowser() {

		let test = it2( async function basicE2e() {

			const pageRequest: phantomjscloud.ioDatatypes.IPageRequest = {
				url: "https://localhost/examples/corpus/example.com.html", renderType: "html", backend: "chrome"
			};

			const userResponse = await browser.requestSingle( pageRequest );
			log.throwCheck( userResponse.content.data.indexOf( "Example Domain" ) >= 0 );

		} );
		test.timeout( 20000 );


		it2( async function htmlBasicPageRequest() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/example.com.html",
				renderType: "plainText",
			};

			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( "Example Domain" ), "content verification failed", response.content.data );

		} );

		// ! production servers fulfill this too fast, so even 50ms ajax calls finish too rapidly for it to be waited on.
		// // it2( async function gracefulFailureExceedMaxWait() {
		// // 	const pageRequest: ioDatatypes.IPageRequest = {
		// // 		url: "http://localhost/examples/corpus/ajax-fast.html",
		// // 		renderType: "plainText",
		// // 		requestSettings: {
		// // 			maxWait: 3000,
		// // 		}
		// // 	};
		// // 	const response = await browser.requestSingle( pageRequest );
		// // 	verifyResponseStatus( response, { contentStatusCode: 408, doneDetail: "error:maxWait" } );
		// // 	log.throwCheck( response.content.data.includes( "this page will make ajax calls" ), "content verification failed", response.content.data );
		// // } );



		it2( async function contentInjection() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/helpers/requestdata",
				renderType: "plainText",
				content: "<html><h1>hello-world</h1></html>",
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( "hello-world" ), "content verification failed", response.content.data );
		} );

		it2( async function redirectJs() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/helpers/requestdata",
				renderType: "plainText",
				content: "<html><script>window.location='https://localhost/examples/corpus/example.com.html';</script><h1>hello-world</h1></html>",
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( "This domain is established to be used" ), "content verification failed", response.content.data );
		} );


		it2( async function doneWhenSelector() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/ajax.html",
				renderType: "plainText",
				requestSettings: {
					doneWhen: [ { text: `"statusCode":206`, statusCode: 202 }, { selector: "pre#fill-target", statusCode: 201 } ],
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 201, doneDetail: "pre#fill-target" } );
			log.throwCheck( response.content.data.includes( "this page will make ajax calls" ), "content verification failed", response.content.data );
		} );

		it2( async function doneWhenDomReady() {
			// loads up an expensive page and renders as soon as possible, tossing out unneeded contents

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://cnn.com",
				renderType: "plainText",
				requestSettings: {
					doneWhen: [ { event: "domReady" } ],
					ignoreImages: true,
					waitInterval: 0,
					resourceWait: 100,
					//disableJavascript:true,
					resourceModifier: [
						{ isBlacklisted: true, regex: ".*" },
						{ isBlacklisted: false, regex: ".*cnn.*" },
						{ isBlacklisted: true, category: "subFrameResource" },
						{ isBlacklisted: true, type: "stylesheet" },
						{ isBlacklisted: true, type: "image" },
						{ isBlacklisted: true, type: "media" },
						{ isBlacklisted: true, type: "texttrack" },
						{ isBlacklisted: true, type: "websocket" },
						{ isBlacklisted: true, type: "other" },
						{ isBlacklisted: true, type: "eventsource" },
						{ isBlacklisted: true, type: "fetch" },
						{ isBlacklisted: true, type: "font" },
						{ isBlacklisted: true, type: "manifest" },
						//{ isBlacklisted: true, type: "xhr" } ,
					],
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { doneDetail: "domReady" } );
			log.throwCheck( response.content.data.includes( "Politics" ), "content verification failed", response.content.data );
		} ).timeout( 15000 );


		// ! prod is too fast for the ajax to delay rendering.   so this forceFinish() test doesn't work.
		// it2( async function forceFinish() {
		// 	const pageRequest: ioDatatypes.IPageRequest = {
		// 		url: "http://localhost/examples/corpus/ajax-fast.html",
		// 		renderType: "plainText",
		// 		requestSettings: { waitInterval: 500 },
		// 		renderSettings: {
		// 			viewport: { height: 20, width: 200 },
		// 		},
		// 		scripts: { domReady: [ "setInterval(function(){var lastY=window.scrollY;window.scrollBy(0,20);if(lastY===window.scrollY){window._pjscMeta.forceFinish=true;}},50);" ] },
		// 	};
		// 	const response = await browser.requestSingle( pageRequest );
		// 	verifyResponseStatus( response, { contentStatusCode: 200, doneDetail: "forceFinish" } );
		// 	log.throwCheck( response.content.data.includes( "this page will make ajax calls" ), "content verification failed", response.content.data );
		// } );

		it2( async function htmlBasicUserRequest() {

			const userRequest: ioDatatypes.IUserRequest = {
				pages: [ {
					url: "http://localhost/examples/helpers/requestdata",
					renderType: "plainText",
					requestSettings: {
						maxWait: 5000,
					}
				} ],
			};
			const response = await browser.requestSingle( userRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( `"user-agent": "Mozilla` ), "content verification failed", response.content.data );
		} );


		it2( async function resourceModifier_changeUrl() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://www.highcharts.com/demo/pie-donut",
				renderType: "html", requestSettings: {
					resourceModifier: [ { regex: ".*highcharts.com.*", changeUrl: "$$protocol:$$port//en.wikipedia.org/wiki$$path" } ]
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 404 } );
			log.throwCheck( response.content.data.includes( "<title>Demo/pie-donut - Wikipedia</title>" ), "content verification failed", response.content.data );
		} );


		it2( async function cookies_inject() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/example.com.html",
				renderType: "plainText",
				requestSettings: {
					cookies: [
						{ domain: "example.com", name: "myCookie1", value: "value1" },
						{ domain: "localhost", name: "myCookie2", value: "value2" } ]
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.pageResponses[ 0 ].cookies.length === 1, "cookie verification failed: cookie count", response.pageResponses[ 0 ].cookies.length );
			log.throwCheck( response.pageResponses[ 0 ].cookies[ 0 ].name === "myCookie2", "cookie verification failed: name" );
			log.throwCheck( response.pageResponses[ 0 ].cookies[ 0 ].value === "value2", "cookie verification failed: value" );
			log.throwCheck( response.content.data.includes( "Example Domain" ), "content verification failed", response.content.data );
		} );


		it2( async function cors_bypass_and_loadFinished_script() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "https://news.ycombinator.com/",
				renderType: "html",
				backend: "chrome",
				requestSettings: {
					maxWait: 10000,
					disableSecureHeaders: true,
				},
				scripts: {
					domReady: [ "http://localhost/examples/scripts/hilitor.js" ],
					loadFinished: [ "var myHilitor = new Hilitor(); myHilitor.apply('ask,who,jobs,new');" ]
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( `<em class="hilitor"` ), "content verification failed", response.content.data );
		} );



		it2( async function translation() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/example.com.html",
				renderType: "plainText",
				requestSettings: { disableSecureHeaders: true, },
				scripts: { pageNavigated: [ "http://localhost/examples/scripts/google-translate.js?targetLang=ko&hideUi=true" ] }
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.indexOf( `예 도메인` ) === 0, "content verification failed", response.content.data );
		} );


		it2( async function redirect_with_scripts_also_verify_content_properties() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/redirect.html",
				renderType: "html",
				scripts: {
					domReady: [ "http://localhost/examples/scripts/hilitor.js" ],
					loadFinished: [ "var myHilitor = new Hilitor(); myHilitor.apply('simple,page,example,http');" ]
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.url === "http://localhost/examples/corpus/simple.html", "should have reddirected" );
			log.throwCheck( response.content.data.includes( `<em class="hilitor" style="background-color: rgb(255, 255, 102); font-style: inherit; color: rgb(0, 0, 0);">Simple</em> Html` ), "content verification failed, scripts did not exec properly", response.content.data );
			log.throwCheck( response.content.name === "localhost-examples-corpus-simple.html", "content name not set properly" );
			log.throwCheck( response.content.pageExecLastWaitedOn.includes( "waitInterval" ), "expected waitInterval to be last thing our page wated on finishing" );
			log.throwCheck( response.content.encoding === "utf8", "expect utf8 encoding for our html output" );

		} );



		it2( async function postBasic() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/helpers/requestdata",
				renderType: "html",
				urlSettings: {
					data: "my=postData",
					operation: "POST",
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( `"my": "postData"` ), "content verification failed, post payload not found", response.content.data );
		} );

		it2( async function postJson_with_passThroughHeaders() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/helpers/requestdata",
				renderType: "plainText",
				outputAsJson: true,
				urlSettings: {
					operation: "POST",
					headers: { hello: "world", "Content-Type": "application/json" },
					data: "{\"yourPostData\":123}",
				},
				renderSettings: {
					passThroughHeaders: true,
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentType: "application/json" } );
			log.throwCheck( response.content.data.includes( `"yourPostData": 123` ), "content verification failed, post payload not found", response.content.data );
		} );

		it2( async function postUnicode() {

			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/helpers/requestdata",
				renderType: "plainText",
				outputAsJson: false,
				urlSettings: {
					operation: "POST",
					// tslint:disable-next-line: max-line-length
					data: "{\"loans\":[{\"account_id\":\"49790094591\",\"account_name\":\"สินเชื่อรถยนต์ใหม่\",\"account_type\":\"CARLOAN\",\"customer_name\":\"นาย บีเอสซีบีคอนเนค คอนเนค นาย\",\"status\":\"ACTIVE\",\"scb_connect\":true,\"linked_date\":\"1537499724000\"},{\"account_id\":\"49790094606\",\"account_name\":\"สินเชื่อรถยนต์ใหม่\",\"account_type\":\"CARLOAN\",\"customer_name\":\"นาย บีเอสซีบีคอนเนค คอนเนค นาย\",\"status\":\"INACTIVE\",\"scb_connect\":true,\"linked_date\":\"1537499724000\"},{\"account_id\":\"49790094614\",\"account_name\":\"สินเชื่อรถยนต์ใหม่\",\"account_type\":\"CARLOAN\",\"customer_name\":\"นาย บีเอสซีบีคอนเนค คอนเนค นาย\",\"status\":\"ACTIVE\",\"scb_connect\":true,\"linked_date\":\"1537499724000\"},{\"account_id\":\"49790094648\",\"account_name\":\"สินเชื่อรถยนต์ใหม่\",\"account_type\":\"CARLOAN\",\"customer_name\":\"นาย บีเอสซีบีคอนเนค คอนเนค นาย\",\"status\":\"ACTIVE\",\"scb_connect\":true,\"linked_date\":\"1537499724000\"},{\"account_id\":\"49790094656\",\"account_name\":\"สินเชื่อรถยนต์ใหม่\",\"account_type\":\"CARLOAN\",\"customer_name\":\"นาย บีเอสซีบีคอนเนค คอนเนค นาย\",\"status\":\"ACTIVE\",\"scb_connect\":true,\"linked_date\":\"1537499724000\"}]}"
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.includes( `สินเชื่อรถยนต` ), "content verification failed, post payload not found", response.content.data );
		} );


		it2( async function scriptOutputDomElement() {

			const pageRequest: ioDatatypes.IPageRequest = {
				outputAsJson: false,
				url: "http://localhost/examples/corpus/example.com.html",
				renderType: "script",
				scripts: {
					domReady: [ "http://localhost/examples/scripts/jquery-3.3.1.min.js" ],
					loadFinished: [ "window._pjscMeta.scriptOutput={h1:$('h1').text()};" ]
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );

			log.throwCheck( _.isPlainObject( response.content.data ), "content verification failed, script output not as expected.  expect a POJO", response.content.data );
			const scriptOutput: { h1: string; } = response.content.data as any;
			log.throwCheck( scriptOutput.h1 === "Example Domain", "content verification failed, script output h1 element not as expected.  expect contents 'Example Domain'", response.content.data );
			log.throwCheck( response.content.name === "localhost-examples-corpus-example-com.json", "expect file extension to be JSON" );
		} );

		it2( async function selectorTest() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/news.ycombinator.com.html",
				renderType: "plainText",
				renderSettings: {
					selector: ".itemlist",
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.data.indexOf( "1." ) === 0, "content verification failed, expect first post 'index number' in beginning of content", response.content.data );
		} );



		it2( async function nullOptionalParameters() {


			const pageRequest = ioDatatypes.pageRequestDefaultsGet();
			_nullAllProperties( pageRequest );

			pageRequest.url = "http://localhost/examples/corpus/example.com.html";
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.encoding === "base64", `content verification failed, expect base64 image.  instead got ${ response.content.encoding }` );
			log.throwCheck( response.content.name === "localhost-examples-corpus-example-com.jpeg", `content verification failed, expect jpeg name.  instead got ${ response.content.name }` );
			log.throwCheck( response.content.size > 30000 && response.content.size < 60000, `content verification failed, expect about 40880 bytes.  instead got ${ response.content.size }` );
		} );

	} ); //end describe("e2e tests");


	describe( "user scenarios", function userScenarios() {

		/** suggested output of the pdfMake tests */
		const pdfMakeOutputStart = "JVBERi0xLjMKJf////8KNSAwIG9iago8PAovVHlwZSAvUGFnZQ";
		const pdfMakeOutputEnd = "Jvb3QgMiAwIFIKL0luZm8gNyAwIFIKPj4Kc3RhcnR4cmVmCjMwMzAKJSVFT0YK";
		/** from email conversation with sean.colonello on 20181017, made script execution synchronous by default, to make this work same as webkit */
		it2( async function chromePdfMake() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				backend: "chrome",
				outputAsJson: true,
				content: "",
				requestSettings: {
					maxWait: 6000,
				},
				renderType: "script",
				scripts: {
					domReady: [],
					load: [],
					loadFinished: [ "http://localhost/examples/scripts/pdfmake-0.1.38.min.js", "http://localhost/examples/scripts/pdfmake-0.1.38.vfs_fonts.js", "_pjscMeta.manualWait=true; var dd={content:'Test'};var pdf=pdfMake.createPdf(dd);pdf.getBase64(function(enc){_pjscMeta.scriptOutput=enc;_pjscMeta.manualWait=false;});" ],
				}
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.name === "localhost-blank.json" );
			log.throwCheck( response.content.size === 4466 );
			log.throwCheck( response.content.data.indexOf( pdfMakeOutputStart ) === 0 );
			log.throwCheck( response.content.data.indexOf( pdfMakeOutputEnd ) === response.content.data.length - pdfMakeOutputEnd.length );
			log.throwCheck( response.content.resourceSummary.complete === 3 );
			log.throwCheck( response.content.resourceSummary.failed === 0 );
			log.throwCheck( response.content.execErrors == null );
		} ).timeout( 6000 );
		/** from email conversation with sean.colonello on 20181017, 
		 * made script execution synchronous by default, this should thus fail because the scripts execute asynchronously
		 * this request is identical to the one above in ```chromePdfMake()``` but this one specifies ```scriptSettings.async=true``` and thus should fail due to race conditions
		 * */
		it2( async function chromePdfMakeFailDueToAsync() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				backend: "chrome",
				outputAsJson: true,
				content: "",
				requestSettings: {
					maxWait: 6000,
				},
				renderType: "script",
				scripts: {
					domReady: [],
					load: [],
					loadFinished: [ "http://localhost/examples/scripts/pdfmake-0.1.38.min.js", "http://localhost/examples/scripts/pdfmake-0.1.38.vfs_fonts.js", "_pjscMeta.manualWait=true; var dd={content:'Test'};var pdf=pdfMake.createPdf(dd);pdf.getBase64(function(enc){_pjscMeta.scriptOutput=enc;_pjscMeta.manualWait=false;});" ],
				},
				scriptSettings: {
					async: true,
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 424, doneDetail: "error:maxWait" } );
			log.throwCheck( response.content.name === "localhost-blank.json" );
			log.throwCheck( response.content.size === 2 );
			log.throwCheck( _.isPlainObject( response.content.data ) );
			log.throwCheck( _.isEmpty( response.content.data ) );
			log.throwCheck( response.content.resourceSummary.complete === 3 );
			log.throwCheck( response.content.resourceSummary.failed === 0 );
			log.throwCheck( response.content.execErrors.length === 2 );
			log.throwCheck( _.find( response.content.execErrors, ( execErr ) => execErr.message.includes( "pdfMake is not defined" ) ) != null, "could not find expected error message in content.execErrors" );
		} ).timeout( 10000 );

		/** from email conversation with sean.colonello on 20181017, this worked in webkit but not chrome */
		it2( async function webkitPdfMake() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				backend: "webkit",
				outputAsJson: true,
				content: "",
				renderType: "script",
				scripts: {
					domReady: [],
					load: [],
					loadFinished: [ "http://localhost/examples/scripts/pdfmake-0.1.38.min.js", "http://localhost/examples/scripts/pdfmake-0.1.38.vfs_fonts.js",
						"_pjscMeta.manualWait=true; var dd={content:'Test'};var pdf=pdfMake.createPdf(dd);pdf.getBase64(function(enc){_pjscMeta.scriptOutput=enc;_pjscMeta.manualWait=false;});" ],
				}
			};

			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { backend: "phantomjs" } );
			log.throwCheck( response.content.name === "content.json" );
			log.throwCheck( response.content.size === 4466 );
			log.throwCheck( response.content.data.indexOf( pdfMakeOutputStart ) === 1 );
			log.throwCheck( response.content.data.indexOf( pdfMakeOutputEnd ) === response.content.data.length - 1 - pdfMakeOutputEnd.length );
		} );

		/** from email conversation with priceline around 20181017, they need to know when a page fails to load properly  */
		it2( async function pricelineBlankPageDetectableError() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				content: "http://localhost/examples/customer-tests/priceline-blank.html",
				"outputAsJson": true,
				"requestSettings": {
					"disableJavascript": true,
					"resourceWait": 500,
					"waitInterval": 500,
					//"resourceModifier": [   {    "regex": ".*qaa.priceline.com.*",    "changeUrl": "$$protocol://www.priceline.com$$path",   }  ],
				},
				"renderSettings": {
					"pdfOptions": {
						"format": "onepage"
					}
				},
				"renderType": "plainText",
				//"renderType": "jpeg",
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 408 } ); //prod times out on this 
			log.throwCheck( response.content.name === "localhost-blank.text" );
			log.throwCheck( response.content.data.includes( "Complete Your Booking" ) );//"Hotels Cars Flights" ) );
			log.throwCheck( response.content.resourceSummary.failed > 0 );
		} ).timeout( 40000 );
		/** from email conversation with priceline around 20181017, they need to know when a page fails to load properly  */
		it2( async function pricelineBlankPageDetectableErrorViaTimeout() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				content: "http://localhost/examples/customer-tests/priceline-blank.html",
				"outputAsJson": true,
				"requestSettings": {
					"disableJavascript": true,
					"resourceWait": 500,
					"waitInterval": 500,
					maxWait: 10000
					//"resourceModifier": [   {    "regex": ".*qaa.priceline.com.*",    "changeUrl": "$$protocol://www.priceline.com$$path",   }  ],
				},
				"renderSettings": {
					"pdfOptions": {
						"format": "onepage"
					}
				},
				"renderType": "plainText",
				//"renderType": "jpeg",
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 408, doneDetail: "error:maxWait" } );
			log.throwCheck( response.content.name === "localhost-blank.text" );
			log.throwCheck( response.content.data.includes( "Complete Your Booking" ) );//"Hotels Cars Flights" ) );
			log.throwCheck( response.content.resourceSummary.late > 0 );
		} ).timeout( 40000 );

		/** from email conversation with priceline around 20181017, they need to know when a page fails to load properly  */
		it2( async function pricelineBlankPageFix() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: null,
				content: "http://localhost/examples/customer-tests/priceline-blank.html",
				"outputAsJson": true,
				"requestSettings": {
					"disableJavascript": true,
					"resourceWait": 500,
					"waitInterval": 500,
					"resourceModifier": [ { "regex": ".*qaa.priceline.com.*", "changeUrl": "$$protocol://www.priceline.com$$path", } ],
				},
				"renderSettings": {
					"pdfOptions": {
						"format": "onepage"
					}
				},
				"renderType": "plainText",
				//"renderType": "jpeg",
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response );
			log.throwCheck( response.content.name === "localhost-blank.text" );
			log.throwCheck( response.content.data.includes( "Complete Your Booking" ) );
			log.throwCheck( response.content.resourceSummary.failed === 0 );
		} ).timeout( 10000 );


	} ); //end describe userScenarios



	describe( "failureTests", function failureTests() {

		it2( async function invalidDomain() {

			let pageRequest: ioDatatypes.IPageRequest = {
				url: "https://www.exadsfakjalkjghlalkjrtiuibe.com",
				renderType: "plainText",
			};
			try {
				const userResponse = await browser.requestSingle( pageRequest );
				throw log.error( "should have failed...", { userResponse } );
			} catch ( _err ) {
				if ( _err.response != null && _err.request && _err instanceof Error ) {
					const axiosErr = _err as axios.AxiosError;
					log.throwCheck( axiosErr.response != null && axiosErr.response.status === 424, "expected error status 424", { axiosErr } );
				} else {
					throw _err;
				}
			}
		} ).timeout( 20000 );

		it2( async function invalidPort() {
			let pageRequest: ioDatatypes.IPageRequest = {
				url: "https://www.example.com:82728",
				renderType: "plainText",
				requestSettings: { maxWait: 3000 },
			};
			try {
				const userResponse = await browser.requestSingle( pageRequest );
				log.error( "should have failed...", { userResponse } );
				throw new Error( "the request should have failed due to invalid URL port" );
			} catch ( _err ) {
				if ( _err.response != null && _err.request && _err instanceof Error ) {
					const axiosErr = _err as axios.AxiosError;
					log.throwCheck( axiosErr.response != null && axiosErr.response.status === 424, "expected error status 424", { axiosErr } );
				} else {
					throw _err;
				}
			}
		} ).timeout( 6000 );

		it2( async function invalidUrl() {
			let pageRequest: ioDatatypes.IPageRequest = {
				url: "//example.com",
			};
			try {
				const userResponse = await browser.requestSingle( pageRequest );
				log.error( "should have failed...", { userResponse } );
				throw new Error( "the request should have failed due to invalid URL" );
			} catch ( _err ) {
				if ( _err.response != null && _err.request && _err instanceof Error ) {
					const axiosErr = _err as axios.AxiosError;
					log.throwCheck( axiosErr.response != null && axiosErr.response.status === 400, "expected error status 400", { axiosErr } );
				} else {
					throw _err;
				}
			}
		} ).timeout( 6000 );


		it2( async function invalidUrlFile() {
			let pageRequest: ioDatatypes.IPageRequest = {
				url: "file://.",
			};
			try {
				const userResponse = await browser.requestSingle( pageRequest );
				log.error( "should have failed...", { userResponse } );
				throw new Error( "the request should have failed due to invalid URL" );
			} catch ( _err ) {
				if ( _err.response != null && _err.request && _err instanceof Error ) {
					const axiosErr = _err as axios.AxiosError;
					log.throwCheck( axiosErr.response != null && axiosErr.response.status === 400, "expected error status 400", { axiosErr } );
				} else {
					throw _err;
				}
			}
		} ).timeout( 6000 );


		it2( async function allNullParameters() {
			let pageRequest = ioDatatypes.pageRequestDefaultsGet();
			pageRequest.url = "http://localhost/examples/corpus/example.com.html";
			_nullAllProperties( pageRequest );

			try {
				const userResponse = await browser.requestSingle( pageRequest );
				log.error( "should have failed...", { userResponse } );
				throw new Error( "the request should have failed due to invalid URL" );
			} catch ( _err ) {
				if ( _err.response != null && _err.request && _err instanceof Error ) {
					const axiosErr = _err as axios.AxiosError;
					log.throwCheck( axiosErr.response != null && axiosErr.response.status === 400, "expected error status 400", { axiosErr } );
				} else {
					throw _err;
				}
			}
		} );

		it2( async function scriptFailureInjected() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/simple.html",
				backend: "chrome",
				outputAsJson: true,
				renderType: "script",
				scripts: {
					loadFinished: [
						"throw new Error('boom');",
					],
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 424 } );//, doneDetail: "error:scripts.loadFinished" } );
		} ).timeout( 6000 );

		it2( async function scriptFailureLoad() {
			const pageRequest: ioDatatypes.IPageRequest = {
				url: "http://localhost/examples/corpus/simple.html",
				backend: "chrome",
				outputAsJson: true,
				renderType: "script",
				scripts: {
					domReady: [ "http://localhost/examples/scripts/does-not-exist.js", ],
				},
			};
			const response = await browser.requestSingle( pageRequest );
			verifyResponseStatus( response, { contentStatusCode: 424 } );//, doneDetail: "error:scripts.domReady" } );
		} ).timeout( 6000 );



	} ); //end describe("failure tests");


} );//end describe(__filename);
