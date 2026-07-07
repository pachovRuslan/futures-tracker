/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/trades/route";
exports.ids = ["app/api/trades/route"];
exports.modules = {

/***/ "(rsc)/./app/api/trades/route.ts":
/*!*********************************!*\
  !*** ./app/api/trades/route.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/api/server.js\");\n/* harmony import */ var _lib_supabase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/supabase */ \"(rsc)/./lib/supabase.ts\");\n\n\nasync function GET(req) {\n    try {\n        const supabase = (0,_lib_supabase__WEBPACK_IMPORTED_MODULE_1__.getSupabaseServerClient)();\n        const { searchParams } = new URL(req.url);\n        const exchange = searchParams.get(\"exchange\");\n        const symbol = searchParams.get(\"symbol\");\n        const limit = Number(searchParams.get(\"limit\") ?? 200);\n        let query = supabase.from(\"trades\").select(\"*\").order(\"closed_at\", {\n            ascending: false\n        }).limit(limit);\n        if (exchange) query = query.eq(\"exchange\", exchange);\n        if (symbol) query = query.eq(\"symbol\", symbol);\n        const [{ data: trades, error: tradesError }, { data: summary, error: summaryError }] = await Promise.all([\n            query,\n            supabase.from(\"monthly_summary\").select(\"*\")\n        ]);\n        if (tradesError) throw tradesError;\n        if (summaryError) throw summaryError;\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            trades,\n            summary\n        });\n    } catch (err) {\n        console.error(\"Trades fetch error\", err);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: err instanceof Error ? err.message : String(err)\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3RyYWRlcy9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBd0Q7QUFDQztBQUVsRCxlQUFlRSxJQUFJQyxHQUFnQjtJQUN4QyxJQUFJO1FBQ0YsTUFBTUMsV0FBV0gsc0VBQXVCQTtRQUN4QyxNQUFNLEVBQUVJLFlBQVksRUFBRSxHQUFHLElBQUlDLElBQUlILElBQUlJLEdBQUc7UUFDeEMsTUFBTUMsV0FBV0gsYUFBYUksR0FBRyxDQUFDO1FBQ2xDLE1BQU1DLFNBQVNMLGFBQWFJLEdBQUcsQ0FBQztRQUNoQyxNQUFNRSxRQUFRQyxPQUFPUCxhQUFhSSxHQUFHLENBQUMsWUFBWTtRQUVsRCxJQUFJSSxRQUFRVCxTQUNUVSxJQUFJLENBQUMsVUFDTEMsTUFBTSxDQUFDLEtBQ1BDLEtBQUssQ0FBQyxhQUFhO1lBQUVDLFdBQVc7UUFBTSxHQUN0Q04sS0FBSyxDQUFDQTtRQUVULElBQUlILFVBQVVLLFFBQVFBLE1BQU1LLEVBQUUsQ0FBQyxZQUFZVjtRQUMzQyxJQUFJRSxRQUFRRyxRQUFRQSxNQUFNSyxFQUFFLENBQUMsVUFBVVI7UUFFdkMsTUFBTSxDQUFDLEVBQUVTLE1BQU1DLE1BQU0sRUFBRUMsT0FBT0MsV0FBVyxFQUFFLEVBQUUsRUFBRUgsTUFBTUksT0FBTyxFQUFFRixPQUFPRyxZQUFZLEVBQUUsQ0FBQyxHQUNsRixNQUFNQyxRQUFRQyxHQUFHLENBQUM7WUFBQ2I7WUFBT1QsU0FBU1UsSUFBSSxDQUFDLG1CQUFtQkMsTUFBTSxDQUFDO1NBQUs7UUFFekUsSUFBSU8sYUFBYSxNQUFNQTtRQUN2QixJQUFJRSxjQUFjLE1BQU1BO1FBRXhCLE9BQU94QixxREFBWUEsQ0FBQzJCLElBQUksQ0FBQztZQUFFUDtZQUFRRztRQUFRO0lBQzdDLEVBQUUsT0FBT0ssS0FBSztRQUNaQyxRQUFRUixLQUFLLENBQUMsc0JBQXNCTztRQUNwQyxPQUFPNUIscURBQVlBLENBQUMyQixJQUFJLENBQ3RCO1lBQUVOLE9BQU9PLGVBQWVFLFFBQVFGLElBQUlHLE9BQU8sR0FBR0MsT0FBT0o7UUFBSyxHQUMxRDtZQUFFSyxRQUFRO1FBQUk7SUFFbEI7QUFDRiIsInNvdXJjZXMiOlsiRDpcXHByb2plY3RzXFxmdXR1cmVzLXRyYWNrZXJcXGFwcFxcYXBpXFx0cmFkZXNcXHJvdXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2UgfSBmcm9tIFwibmV4dC9zZXJ2ZXJcIjtcbmltcG9ydCB7IGdldFN1cGFiYXNlU2VydmVyQ2xpZW50IH0gZnJvbSBcIkAvbGliL3N1cGFiYXNlXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxOiBOZXh0UmVxdWVzdCkge1xuICB0cnkge1xuICAgIGNvbnN0IHN1cGFiYXNlID0gZ2V0U3VwYWJhc2VTZXJ2ZXJDbGllbnQoKTtcbiAgICBjb25zdCB7IHNlYXJjaFBhcmFtcyB9ID0gbmV3IFVSTChyZXEudXJsKTtcbiAgICBjb25zdCBleGNoYW5nZSA9IHNlYXJjaFBhcmFtcy5nZXQoXCJleGNoYW5nZVwiKTtcbiAgICBjb25zdCBzeW1ib2wgPSBzZWFyY2hQYXJhbXMuZ2V0KFwic3ltYm9sXCIpO1xuICAgIGNvbnN0IGxpbWl0ID0gTnVtYmVyKHNlYXJjaFBhcmFtcy5nZXQoXCJsaW1pdFwiKSA/PyAyMDApO1xuXG4gICAgbGV0IHF1ZXJ5ID0gc3VwYWJhc2VcbiAgICAgIC5mcm9tKFwidHJhZGVzXCIpXG4gICAgICAuc2VsZWN0KFwiKlwiKVxuICAgICAgLm9yZGVyKFwiY2xvc2VkX2F0XCIsIHsgYXNjZW5kaW5nOiBmYWxzZSB9KVxuICAgICAgLmxpbWl0KGxpbWl0KTtcblxuICAgIGlmIChleGNoYW5nZSkgcXVlcnkgPSBxdWVyeS5lcShcImV4Y2hhbmdlXCIsIGV4Y2hhbmdlKTtcbiAgICBpZiAoc3ltYm9sKSBxdWVyeSA9IHF1ZXJ5LmVxKFwic3ltYm9sXCIsIHN5bWJvbCk7XG5cbiAgICBjb25zdCBbeyBkYXRhOiB0cmFkZXMsIGVycm9yOiB0cmFkZXNFcnJvciB9LCB7IGRhdGE6IHN1bW1hcnksIGVycm9yOiBzdW1tYXJ5RXJyb3IgfV0gPVxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW3F1ZXJ5LCBzdXBhYmFzZS5mcm9tKFwibW9udGhseV9zdW1tYXJ5XCIpLnNlbGVjdChcIipcIildKTtcblxuICAgIGlmICh0cmFkZXNFcnJvcikgdGhyb3cgdHJhZGVzRXJyb3I7XG4gICAgaWYgKHN1bW1hcnlFcnJvcikgdGhyb3cgc3VtbWFyeUVycm9yO1xuXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgdHJhZGVzLCBzdW1tYXJ5IH0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVHJhZGVzIGZldGNoIGVycm9yXCIsIGVycik7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKFxuICAgICAgeyBlcnJvcjogZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpIH0sXG4gICAgICB7IHN0YXR1czogNTAwIH1cbiAgICApO1xuICB9XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiZ2V0U3VwYWJhc2VTZXJ2ZXJDbGllbnQiLCJHRVQiLCJyZXEiLCJzdXBhYmFzZSIsInNlYXJjaFBhcmFtcyIsIlVSTCIsInVybCIsImV4Y2hhbmdlIiwiZ2V0Iiwic3ltYm9sIiwibGltaXQiLCJOdW1iZXIiLCJxdWVyeSIsImZyb20iLCJzZWxlY3QiLCJvcmRlciIsImFzY2VuZGluZyIsImVxIiwiZGF0YSIsInRyYWRlcyIsImVycm9yIiwidHJhZGVzRXJyb3IiLCJzdW1tYXJ5Iiwic3VtbWFyeUVycm9yIiwiUHJvbWlzZSIsImFsbCIsImpzb24iLCJlcnIiLCJjb25zb2xlIiwiRXJyb3IiLCJtZXNzYWdlIiwiU3RyaW5nIiwic3RhdHVzIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./app/api/trades/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/supabase.ts":
/*!*************************!*\
  !*** ./lib/supabase.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getSupabaseServerClient: () => (/* binding */ getSupabaseServerClient)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"(rsc)/./node_modules/.pnpm/@supabase+supabase-js@2.110.0/node_modules/@supabase/supabase-js/dist/index.mjs\");\n\n// Используем service_role ключ — приложение single-user, все запросы идут\n// через собственные API-роуты, поэтому RLS можно не поднимать.\n// НИКОГДА не импортировать этот файл в клиентские компоненты.\nfunction getSupabaseServerClient() {\n    const url = process.env.SUPABASE_URL;\n    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n    if (!url || !key) {\n        throw new Error(\"SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы в переменных окружения\");\n    }\n    return (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(url, key, {\n        auth: {\n            persistSession: false\n        }\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvc3VwYWJhc2UudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBcUQ7QUFFckQsMEVBQTBFO0FBQzFFLCtEQUErRDtBQUMvRCw4REFBOEQ7QUFDdkQsU0FBU0M7SUFDZCxNQUFNQyxNQUFNQyxRQUFRQyxHQUFHLENBQUNDLFlBQVk7SUFDcEMsTUFBTUMsTUFBTUgsUUFBUUMsR0FBRyxDQUFDRyx5QkFBeUI7SUFFakQsSUFBSSxDQUFDTCxPQUFPLENBQUNJLEtBQUs7UUFDaEIsTUFBTSxJQUFJRSxNQUNSO0lBRUo7SUFFQSxPQUFPUixtRUFBWUEsQ0FBQ0UsS0FBS0ksS0FBSztRQUM1QkcsTUFBTTtZQUFFQyxnQkFBZ0I7UUFBTTtJQUNoQztBQUNGIiwic291cmNlcyI6WyJEOlxccHJvamVjdHNcXGZ1dHVyZXMtdHJhY2tlclxcbGliXFxzdXBhYmFzZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tIFwiQHN1cGFiYXNlL3N1cGFiYXNlLWpzXCI7XG5cbi8vINCY0YHQv9C+0LvRjNC30YPQtdC8IHNlcnZpY2Vfcm9sZSDQutC70Y7RhyDigJQg0L/RgNC40LvQvtC20LXQvdC40LUgc2luZ2xlLXVzZXIsINCy0YHQtSDQt9Cw0L/RgNC+0YHRiyDQuNC00YPRglxuLy8g0YfQtdGA0LXQtyDRgdC+0LHRgdGC0LLQtdC90L3Ri9C1IEFQSS3RgNC+0YPRgtGLLCDQv9C+0Y3RgtC+0LzRgyBSTFMg0LzQvtC20L3QviDQvdC1INC/0L7QtNC90LjQvNCw0YLRjC5cbi8vINCd0JjQmtCe0JPQlNCQINC90LUg0LjQvNC/0L7RgNGC0LjRgNC+0LLQsNGC0Ywg0Y3RgtC+0YIg0YTQsNC50Lsg0LIg0LrQu9C40LXQvdGC0YHQutC40LUg0LrQvtC80L/QvtC90LXQvdGC0YsuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwYWJhc2VTZXJ2ZXJDbGllbnQoKSB7XG4gIGNvbnN0IHVybCA9IHByb2Nlc3MuZW52LlNVUEFCQVNFX1VSTDtcbiAgY29uc3Qga2V5ID0gcHJvY2Vzcy5lbnYuU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWTtcblxuICBpZiAoIXVybCB8fCAha2V5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJTVVBBQkFTRV9VUkwgLyBTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZINC90LUg0LfQsNC00LDQvdGLINCyINC/0LXRgNC10LzQtdC90L3Ri9GFINC+0LrRgNGD0LbQtdC90LjRj1wiXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVDbGllbnQodXJsLCBrZXksIHtcbiAgICBhdXRoOiB7IHBlcnNpc3RTZXNzaW9uOiBmYWxzZSB9LFxuICB9KTtcbn1cbiJdLCJuYW1lcyI6WyJjcmVhdGVDbGllbnQiLCJnZXRTdXBhYmFzZVNlcnZlckNsaWVudCIsInVybCIsInByb2Nlc3MiLCJlbnYiLCJTVVBBQkFTRV9VUkwiLCJrZXkiLCJTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZIiwiRXJyb3IiLCJhdXRoIiwicGVyc2lzdFNlc3Npb24iXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./lib/supabase.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrades%2Froute&page=%2Fapi%2Ftrades%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrades%2Froute.ts&appDir=D%3A%5Cprojects%5Cfutures-tracker%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5Cprojects%5Cfutures-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrades%2Froute&page=%2Fapi%2Ftrades%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrades%2Froute.ts&appDir=D%3A%5Cprojects%5Cfutures-tracker%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5Cprojects%5Cfutures-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var D_projects_futures_tracker_app_api_trades_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/trades/route.ts */ \"(rsc)/./app/api/trades/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/trades/route\",\n        pathname: \"/api/trades\",\n        filename: \"route\",\n        bundlePath: \"app/api/trades/route\"\n    },\n    resolvedPagePath: \"D:\\\\projects\\\\futures-tracker\\\\app\\\\api\\\\trades\\\\route.ts\",\n    nextConfigOutput,\n    userland: D_projects_futures_tracker_app_api_trades_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvLnBucG0vbmV4dEAxNS4zLjBfcmVhY3QtZG9tQDE5LjIuN19yZWFjdEAxOS4yLjdfX3JlYWN0QDE5LjIuNy9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZ0cmFkZXMlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRnRyYWRlcyUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRnRyYWRlcyUyRnJvdXRlLnRzJmFwcERpcj1EJTNBJTVDcHJvamVjdHMlNUNmdXR1cmVzLXRyYWNrZXIlNUNhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPUQlM0ElNUNwcm9qZWN0cyU1Q2Z1dHVyZXMtdHJhY2tlciZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDcUI7QUFDUztBQUN0RjtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiRDpcXFxccHJvamVjdHNcXFxcZnV0dXJlcy10cmFja2VyXFxcXGFwcFxcXFxhcGlcXFxcdHJhZGVzXFxcXHJvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS90cmFkZXMvcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS90cmFkZXNcIixcbiAgICAgICAgZmlsZW5hbWU6IFwicm91dGVcIixcbiAgICAgICAgYnVuZGxlUGF0aDogXCJhcHAvYXBpL3RyYWRlcy9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIkQ6XFxcXHByb2plY3RzXFxcXGZ1dHVyZXMtdHJhY2tlclxcXFxhcHBcXFxcYXBpXFxcXHRyYWRlc1xcXFxyb3V0ZS50c1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHdvcmtBc3luY1N0b3JhZ2UsXG4gICAgICAgIHdvcmtVbml0QXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrades%2Froute&page=%2Fapi%2Ftrades%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrades%2Froute.ts&appDir=D%3A%5Cprojects%5Cfutures-tracker%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5Cprojects%5Cfutures-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!*********************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \*********************************************************************************************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!*********************************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \*********************************************************************************************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7","vendor-chunks/@supabase+auth-js@2.110.0","vendor-chunks/@supabase+storage-js@2.110.0","vendor-chunks/@supabase+postgrest-js@2.110.0","vendor-chunks/@supabase+realtime-js@2.110.0","vendor-chunks/@supabase+phoenix@0.4.4","vendor-chunks/@supabase+supabase-js@2.110.0","vendor-chunks/tslib@2.8.1","vendor-chunks/iceberg-js@0.8.1","vendor-chunks/@supabase+functions-js@2.110.0"], () => (__webpack_exec__("(rsc)/./node_modules/.pnpm/next@15.3.0_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrades%2Froute&page=%2Fapi%2Ftrades%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrades%2Froute.ts&appDir=D%3A%5Cprojects%5Cfutures-tracker%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5Cprojects%5Cfutures-tracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();