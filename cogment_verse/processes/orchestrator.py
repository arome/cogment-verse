# Copyright 2022 AI Redefined Inc. <dev+cogment@ai-r.com>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from .cogment_cli_process import CogmentCliProcess
from ..services_directory import ServiceType


def create_orchestrator_service(work_dir, orchestrator_name, orchestrator_cfg, services_directory):
    port = orchestrator_cfg.port
    web_port = orchestrator_cfg.web_port
    prometheus_port = orchestrator_cfg.get("prometheus_port", 0)
    services_directory.add(
        service_type=ServiceType.ORCHESTRATOR,
        service_endpoint=f"grpc://localhost:{port}",
    )
    services_directory.add(
        service_type=ServiceType.ORCHESTRATOR_WEB_ENDPOINT,
        service_endpoint=f"http://localhost:{web_port}",
    )
    if prometheus_port != 0:
        services_directory.add(
            service_type=ServiceType.PROMETHEUS,
            service_name=f"orchestrator/{orchestrator_name}",
            service_endpoint=f"http://localhost:{prometheus_port}",
        )
    return CogmentCliProcess(
        name=orchestrator_name,
        work_dir=work_dir,
        cli_args=[
            "services",
            "orchestrator",
            "--log_format=json",
            f"--prometheus_port={prometheus_port}",
            f"--log_level={orchestrator_cfg.log_level}",
            f"--actor_port={port}",
            f"--lifecycle_port={port}",
            f"--actor_web_port={web_port}",
        ],
    )
