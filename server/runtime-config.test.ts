import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { runtimeConfigurationFromEnvironment } from './runtime-config.ts'

const mounted = resolve('runtime-test-volume')
const deployed: NodeJS.ProcessEnv = {
  PORTAL_API_HOST: '0.0.0.0',
  PORTAL_WEB_ORIGIN: 'https://learning.example.test',
  PORTAL_DB_PATH: join(mounted, 'portal.sqlite'),
}

test('runtime remains loopback-only by default and supports platform PORT without changing the host', () => {
  assert.deepEqual(runtimeConfigurationFromEnvironment({}), {
    host: '127.0.0.1',
    port: 4003,
    dbPath: resolve('.local/portal/portal.sqlite'),
  })
  assert.equal(runtimeConfigurationFromEnvironment({ PORT: '8080' }).port, 8080)
  assert.equal(runtimeConfigurationFromEnvironment({ PORT: '8080' }).host, '127.0.0.1')
  assert.equal(
    runtimeConfigurationFromEnvironment({ PORT: '8080', PORTAL_API_PORT: '4005' }).port,
    4005,
  )
  assert.equal(runtimeConfigurationFromEnvironment({ PORTAL_API_HOST: '::1' }).host, '::1')
})

test('runtime rejects invalid ports and unexpected bind addresses before opening a database', () => {
  for (const value of ['', '0', '-1', '65536', '80.5', '1e3', '0xFA3', 'NaN', '4003 '])
    assert.throws(() => runtimeConfigurationFromEnvironment({ PORT: value }), /valid TCP port/)
  for (const value of ['', '*', 'localhost', '192.168.1.1', '::'])
    assert.throws(
      () => runtimeConfigurationFromEnvironment({ PORTAL_API_HOST: value }),
      /PORTAL_API_HOST/,
    )
  assert.throws(
    () => runtimeConfigurationFromEnvironment({ PORTAL_DB_PATH: '' }),
    /must not be empty/,
  )
})

test('public runtime requires exact HTTPS origins, rejecting wildcard and credential/path origins', () => {
  assert.equal(runtimeConfigurationFromEnvironment(deployed).host, '0.0.0.0')
  assert.equal(
    runtimeConfigurationFromEnvironment({
      ...deployed,
      PORTAL_WEB_ORIGIN: 'https://learning.example.test, https://preview.example.test',
    }).host,
    '0.0.0.0',
  )
  for (const origin of [
    undefined,
    '',
    '*',
    'http://learning.example.test',
    'https://*.example.test',
    'https://user:password@example.test',
    'https://learning.example.test/',
    'https://learning.example.test/learn',
    'https://learning.example.test?query=1',
    'https://learning.example.test#fragment',
    'https://learning.example.test,',
    'https://localhost',
  ])
    assert.throws(
      () => runtimeConfigurationFromEnvironment({ ...deployed, PORTAL_WEB_ORIGIN: origin }),
      /PORTAL_WEB_ORIGIN/,
    )
  assert.throws(
    () => runtimeConfigurationFromEnvironment({ NODE_ENV: 'production' }),
    /PORTAL_WEB_ORIGIN/,
  )
})

test('public runtime requires an explicit absolute database path; local relative paths still work', () => {
  for (const dbPath of [undefined, '', ':memory:', '.local/portal/portal.sqlite'])
    assert.throws(
      () => runtimeConfigurationFromEnvironment({ ...deployed, PORTAL_DB_PATH: dbPath }),
      /absolute PORTAL_DB_PATH/,
    )
  assert.equal(
    runtimeConfigurationFromEnvironment({ PORTAL_DB_PATH: 'local-test/portal.sqlite' }).dbPath,
    resolve('local-test/portal.sqlite'),
  )
})

test('Railway cannot start without a volume or persist a database outside its mount', () => {
  const railway = { ...deployed, RAILWAY_ENVIRONMENT_ID: 'environment-test' }
  assert.throws(
    () => runtimeConfigurationFromEnvironment(railway),
    /Attach a persistent Railway volume/,
  )
  for (const dbPath of [
    mounted,
    join(mounted, '..', 'ephemeral.sqlite'),
    `${mounted}-other/portal.sqlite`,
  ])
    assert.throws(
      () =>
        runtimeConfigurationFromEnvironment({
          ...railway,
          PORTAL_DB_PATH: dbPath,
          RAILWAY_VOLUME_MOUNT_PATH: mounted,
        }),
      /inside the attached Railway volume/,
    )
  assert.equal(
    runtimeConfigurationFromEnvironment({ ...railway, RAILWAY_VOLUME_MOUNT_PATH: mounted }).dbPath,
    deployed.PORTAL_DB_PATH,
  )
})
