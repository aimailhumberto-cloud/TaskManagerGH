import {writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {analyticsFixture} from './whatsappAnalyticsFixture';
if(process.argv[2]!=='synthetic-only')throw Error('Isolated fixture command only');writeFileSync(resolve('.local-data/whatsapp-analytics-fixture.json'),JSON.stringify(analyticsFixture('local-humberto'),null,2));
