# Integration and functional test targets for ai-ready
# This file extends the standard test setup with additional test types

#####
# Functional tests (CLI-level tests using execFile)
#####

FUNCTIONAL_TEST_REPORT:=$(QA)/functional-test.txt
FUNCTIONAL_TEST_PASS_MARKER:=$(QA)/.functional-test.passed
FUNCTIONAL_TEST_STAGING:=$(TEST_STAGING)/tests/functional
FUNCTIONAL_TEST_FILES:=$(wildcard tests/functional/*.js)
FUNCTIONAL_TEST_FILES_BUILT:=$(patsubst tests/functional/%, $(FUNCTIONAL_TEST_STAGING)/%, $(FUNCTIONAL_TEST_FILES))

# Transpile functional tests to test-staging
$(SDLC_FUNCTIONAL_TEST_FILES_BUILT) &: $(SDLC_FUNCTIONAL_TEST_FILES_SRC)
	$(call build_test_files,$(TESTS)/functional,$(TEST_STAGING)/$(TESTS)/functional)

.PHONY: functional-test
functional-test: build $(FUNCTIONAL_TEST_PASS_MARKER) $(FUNCTIONAL_TEST_REPORT)

$(FUNCTIONAL_TEST_PASS_MARKER) $(FUNCTIONAL_TEST_REPORT): dist/ai-ready-exec.js $(SDLC_MAIN_AND_FUNCTIONAL_TEST_BUILT) clean-stale-test-files
	@echo "Running functional tests..."
	@mkdir -p $(QA)
	@echo -n 'Functional test git rev: ' > $(FUNCTIONAL_TEST_REPORT)
	@git rev-parse HEAD >> $(FUNCTIONAL_TEST_REPORT)
	@# the function test involve running the CLI commands in a subprocess, so coverage is not applicable
	@( set -e; set -o pipefail; \
	  ( cd $(TEST_STAGING) && NODE_OPTIONS=--no-warnings $(SDLC_JEST) \
	    --config=$(SDLC_JEST_CONFIG) \
	    --testMatch='**/tests/functional/**/*.test.js' \
	    --runInBand \
		--no-coverage \
		$(TEST) \
		2>&1 ) \
	  | tee -a $(FUNCTIONAL_TEST_REPORT); \
	  touch $(FUNCTIONAL_TEST_PASS_MARKER) )
	@echo "✔ Functional tests passed"

#####
# Integration tests (Docker-based or standalone)
#####

INTEGRATION_TEST_REPORT:=$(QA)/integration-test.txt
INTEGRATION_TEST_PASS_MARKER:=$(QA)/.integration-test.passed
INTEGRATION_TEST_STAGING:=$(TEST_STAGING)/tests/integration
INTEGRATION_TEST_FILES:=$(wildcard tests/integration/*.js)
INTEGRATION_TEST_FILES_BUILT:=$(patsubst tests/integration/%, $(INTEGRATION_TEST_STAGING)/%, $(INTEGRATION_TEST_FILES))

# Transpile integration tests to test-staging
# Transpile functional tests to test-staging
$(SDLC_INTEGRATION_TEST_FILES_BUILT) &: $(SDLC_INTEGRATION_TEST_FILES_SRC)
	$(call build_test_files,$(TESTS)/integration,$(TEST_STAGING)/$(TESTS)/integration)

.PHONY: integration-test
integration-test: build $(INTEGRATION_TEST_PASS_MARKER)

$(INTEGRATION_TEST_PASS_MARKER) $(INTEGRATION_TEST_REPORT): dist/ai-ready-exec.js $(SDLC_MAIN_AND_INTEGRATION_TEST_BUILT) clean-stale-test-files
	@echo "Running integration tests..."
	@mkdir -p $(QA)
	@echo -n 'Integration test git rev: ' > $(INTEGRATION_TEST_REPORT)
	@git rev-parse HEAD >> $(INTEGRATION_TEST_REPORT)
	@# the integration test involve running the CLI commands in a subprocess, so coverage is not applicable
	@( set -e; set -o pipefail; \
	  ( cd $(TEST_STAGING) && NODE_OPTIONS=--no-warnings $(SDLC_JEST) \
	    --config=$(SDLC_JEST_CONFIG) \
	    --testMatch='**/tests/integration/**/*.test.js' \
	    --runInBand \
	    --no-coverage \
	    --testTimeout=30000 \
		$(TEST) \
		2>&1 ) \
	  | tee -a $(INTEGRATION_TEST_REPORT); \
	  touch $(INTEGRATION_TEST_PASS_MARKER) )
	@echo "✔ Integration tests passed"

.PHONY: integration-test-docker
integration-test-docker: build
	@echo "Running Docker-based integration tests..."
	@./tests/integration/integration-test.sh

#####
# Combined test targets
#####

.PHONY: test-functional
test-functional: functional-test

.PHONY: test-integration
test-integration: integration-test

.PHONY: test-all
test-all: test functional-test integration-test
	@echo "✔ All tests (unit + functional + integration) passed"

#####
# Update phony targets
#####

PHONY_TARGETS+=functional-test integration-test integration-test-docker test-functional test-integration test-all

#####
# end integration tests
#####
