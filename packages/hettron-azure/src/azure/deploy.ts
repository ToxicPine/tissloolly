import {
  createOrUpdateContainerApp,
  enableExternalIngress,
  probeAppAuth,
} from "./app.ts";
import {
  configureEasyAuth,
  ensureEntraApp,
  restrictEasyAuthToSignedInUser,
} from "./auth.ts";
import {
  configureEnvironmentStorage,
  ensureContainerAppEnvironment,
  ensureFileShares,
  ensureLogWorkspace,
  ensureManagedIdentity,
  ensureProviders,
  ensureResourceGroup,
  ensureStorageAccount,
  getEnvironmentDefaultDomain,
  selectSubscription,
} from "./resources.ts";
import {
  CONTAINER_APP_NAME,
  DEFAULT_LOCATION,
  resourceGroupForAccount,
  storageAccountForResourceGroup,
} from "../domain/names.ts";
import type { DeployInput, DeployOutput } from "../domain/types.ts";

export async function deployAzureResources(
  input: DeployInput,
  tenantId: string,
): Promise<DeployOutput> {
  const location = input.location ?? DEFAULT_LOCATION;
  const resourceGroupName = await resourceGroupForAccount(
    input.accountEmail,
    input.subscriptionId,
  );
  const storageAccountName = storageAccountForResourceGroup(resourceGroupName);

  await selectSubscription(input.subscriptionId);
  await ensureProviders(input.subscriptionId);
  await ensureResourceGroup(input.subscriptionId, resourceGroupName, location);
  await ensureStorageAccount(
    input.subscriptionId,
    resourceGroupName,
    storageAccountName,
    location,
  );
  await ensureFileShares(
    input.subscriptionId,
    resourceGroupName,
    storageAccountName,
  );
  await ensureManagedIdentity(
    input.subscriptionId,
    resourceGroupName,
    location,
  );

  await ensureLogWorkspace(input.subscriptionId, resourceGroupName, location);
  await ensureContainerAppEnvironment(
    input.subscriptionId,
    resourceGroupName,
    location,
  );
  await configureEnvironmentStorage(
    input.subscriptionId,
    resourceGroupName,
    storageAccountName,
  );

  const defaultDomain = await getEnvironmentDefaultDomain(
    input.subscriptionId,
    resourceGroupName,
  );
  const appFqdn = `${CONTAINER_APP_NAME}.${defaultDomain}`;
  const appId = await ensureEntraApp(input, appFqdn);

  await createOrUpdateContainerApp(
    input.subscriptionId,
    resourceGroupName,
    location,
  );
  await configureEasyAuth(
    input.subscriptionId,
    resourceGroupName,
    tenantId,
    appId,
  );
  await restrictEasyAuthToSignedInUser(input.subscriptionId, resourceGroupName);
  await enableExternalIngress(input.subscriptionId, resourceGroupName);
  await probeAppAuth(appFqdn);

  return { resourceGroupName };
}
