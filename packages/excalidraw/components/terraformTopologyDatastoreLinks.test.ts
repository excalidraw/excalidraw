import { describe, expect, it } from "vitest";

import {
  buildAuroraCompanionCluster,
  buildRdsCompanionCluster,
  isDatastoreCompanionConsumedAsSatellite,
  resolveDbSubnetGroupSubnetIds,
} from "./terraformTopologyDatastoreLinks";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

function auroraModuleNodes(): TerraformPlanNodesMap {
  return {
    "module.api3_aurora.aws_rds_cluster.this": {
      resources: {
        "module.api3_aurora.aws_rds_cluster.this": {
          address: "module.api3_aurora.aws_rds_cluster.this",
          mode: "managed",
          type: "aws_rds_cluster",
          change: {
            actions: ["create"],
            after: {
              cluster_identifier: "api-3",
              id: "api-3-cluster",
              db_subnet_group_name: "api-3-subnet-group",
              vpc_security_group_ids: ["sg-aurora"],
            },
          },
        },
      },
    },
    "module.api3_aurora.aws_rds_cluster_instance.this[0]": {
      resources: {
        "module.api3_aurora.aws_rds_cluster_instance.this[0]": {
          address: "module.api3_aurora.aws_rds_cluster_instance.this[0]",
          mode: "managed",
          type: "aws_rds_cluster_instance",
          change: {
            actions: ["create"],
            after: {
              identifier: "api-3-1",
              cluster_identifier: "api-3-cluster",
            },
          },
        },
      },
    },
    "module.api3_aurora.aws_rds_cluster_instance.this[1]": {
      resources: {
        "module.api3_aurora.aws_rds_cluster_instance.this[1]": {
          address: "module.api3_aurora.aws_rds_cluster_instance.this[1]",
          mode: "managed",
          type: "aws_rds_cluster_instance",
          change: {
            actions: ["create"],
            after: {
              identifier: "api-3-2",
              cluster_identifier: "api-3-cluster",
            },
          },
        },
      },
    },
    "module.api3_aurora.aws_db_subnet_group.this": {
      resources: {
        "module.api3_aurora.aws_db_subnet_group.this": {
          address: "module.api3_aurora.aws_db_subnet_group.this",
          mode: "managed",
          type: "aws_db_subnet_group",
          change: {
            actions: ["create"],
            after: {
              name: "api-3-subnet-group",
              subnet_ids: ["subnet-db-a", "subnet-db-b"],
            },
          },
        },
      },
    },
    "module.api3_aurora.aws_secretsmanager_secret.db": {
      resources: {
        "module.api3_aurora.aws_secretsmanager_secret.db": {
          address: "module.api3_aurora.aws_secretsmanager_secret.db",
          mode: "managed",
          type: "aws_secretsmanager_secret",
          change: {
            actions: ["create"],
            after: { name: "api-3-db-credentials", id: "secret-1" },
          },
        },
      },
    },
    "module.api3_aurora.aws_secretsmanager_secret_version.db": {
      resources: {
        "module.api3_aurora.aws_secretsmanager_secret_version.db": {
          address: "module.api3_aurora.aws_secretsmanager_secret_version.db",
          mode: "managed",
          type: "aws_secretsmanager_secret_version",
          change: {
            actions: ["create"],
            after: { secret_id: "secret-1" },
          },
        },
      },
    },
  };
}

describe("terraformTopologyDatastoreLinks", () => {
  it("buildAuroraCompanionCluster collects module-scoped instances, subnet group, and secrets", () => {
    const nodes = auroraModuleNodes();
    const { cluster, edges } = buildAuroraCompanionCluster(
      nodes,
      "module.api3_aurora.aws_rds_cluster.this",
    );
    expect(cluster).not.toBeNull();
    expect(cluster!.instances).toHaveLength(2);
    expect(cluster!.subnetGroup).toBe(
      "module.api3_aurora.aws_db_subnet_group.this",
    );
    expect(cluster!.secret).toBe(
      "module.api3_aurora.aws_secretsmanager_secret.db",
    );
    expect(cluster!.secretVersion).toBe(
      "module.api3_aurora.aws_secretsmanager_secret_version.db",
    );
    expect(edges.some((e) => e.type === "aurora_cluster_instance")).toBe(true);
    expect(edges.some((e) => e.type === "db_credentials")).toBe(true);
  });

  it("buildRdsCompanionCluster collects subnet group and secrets for aws_db_instance", () => {
    const nodes: TerraformPlanNodesMap = {
      "module.api2_rds.aws_db_instance.this": {
        resources: {
          "module.api2_rds.aws_db_instance.this": {
            address: "module.api2_rds.aws_db_instance.this",
            mode: "managed",
            type: "aws_db_instance",
            change: {
              actions: ["create"],
              after: {
                identifier: "api-2",
                db_subnet_group_name: "api-2-subnet-group",
              },
            },
          },
        },
      },
      "module.api2_rds.aws_db_subnet_group.this": {
        resources: {
          "module.api2_rds.aws_db_subnet_group.this": {
            address: "module.api2_rds.aws_db_subnet_group.this",
            mode: "managed",
            type: "aws_db_subnet_group",
            change: {
              actions: ["create"],
              after: {
                name: "api-2-subnet-group",
                subnet_ids: ["subnet-db-c"],
              },
            },
          },
        },
      },
      "module.api2_rds.aws_secretsmanager_secret.db": {
        resources: {
          "module.api2_rds.aws_secretsmanager_secret.db": {
            address: "module.api2_rds.aws_secretsmanager_secret.db",
            mode: "managed",
            type: "aws_secretsmanager_secret",
            change: {
              actions: ["create"],
              after: { id: "secret-rds" },
            },
          },
        },
      },
    };
    const { cluster } = buildRdsCompanionCluster(
      nodes,
      "module.api2_rds.aws_db_instance.this",
    );
    expect(cluster!.subnetGroup).toBe(
      "module.api2_rds.aws_db_subnet_group.this",
    );
    expect(cluster!.secret).toBe(
      "module.api2_rds.aws_secretsmanager_secret.db",
    );
  });

  it("isDatastoreCompanionConsumedAsSatellite marks cluster instances as consumed", () => {
    const nodes = auroraModuleNodes();
    expect(
      isDatastoreCompanionConsumedAsSatellite(
        nodes,
        "module.api3_aurora.aws_rds_cluster_instance.this[0]",
      ),
    ).toBe(true);
    expect(
      isDatastoreCompanionConsumedAsSatellite(
        nodes,
        "module.api3_aurora.aws_rds_cluster.this",
      ),
    ).toBe(false);
  });

  it("resolveDbSubnetGroupSubnetIds reads subnet_ids from matching db_subnet_group", () => {
    const plan = {
      resource_changes: [
        {
          address: "module.api3_aurora.aws_rds_cluster.this",
          type: "aws_rds_cluster",
          mode: "managed",
          change: {
            after: {
              db_subnet_group_name: "api-3-subnet-group",
            },
          },
        },
        {
          address: "module.api3_aurora.aws_db_subnet_group.this",
          type: "aws_db_subnet_group",
          mode: "managed",
          change: {
            after: {
              name: "api-3-subnet-group",
              subnet_ids: ["subnet-db-a", "subnet-db-b"],
            },
          },
        },
      ],
    };
    const subnets = resolveDbSubnetGroupSubnetIds(
      plan,
      "module.api3_aurora.aws_rds_cluster.this",
      { db_subnet_group_name: "api-3-subnet-group" },
    );
    expect(subnets).toEqual(["subnet-db-a", "subnet-db-b"]);
  });
});
