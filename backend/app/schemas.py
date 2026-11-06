"""Modelos de entrada (validação) — mesmos nomes de campo usados pelo frontend.

Campos que o cliente não pode definir (id, status, pago_em...) simplesmente
não existem aqui; qualquer campo extra enviado é rejeitado.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from . import validacao as v


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LoginEntrada(_Base):
    usuario: str = Field(min_length=1, max_length=60)
    senha: str = Field(min_length=1, max_length=200)


class ClienteEntrada(_Base):
    nome_cliente: str = Field(max_length=120)
    cpf_cnpj: str
    telefone_cliente: str
    email_cliente: str = Field(default="", max_length=150)
    endereco_cliente: str = Field(default="", max_length=180)
    bairro_cliente: str = Field(default="", max_length=80)
    obs_cliente: str = Field(default="", max_length=300)

    @field_validator("nome_cliente")
    @classmethod
    def _nome(cls, valor: str) -> str:
        if not valor:
            raise ValueError("Informe o nome completo.")
        return valor

    @field_validator("cpf_cnpj")
    @classmethod
    def _cpf_cnpj(cls, valor: str) -> str:
        if not v.cpf_cnpj_valido(valor):
            raise ValueError("Informe um CPF ou CNPJ válido.")
        return v.formatar_cpf_cnpj(valor)

    @field_validator("telefone_cliente")
    @classmethod
    def _telefone(cls, valor: str) -> str:
        if not v.telefone_valido(valor):
            raise ValueError("Informe um telefone com DDD (10 ou 11 dígitos).")
        return v.formatar_telefone(valor)

    @field_validator("email_cliente")
    @classmethod
    def _email(cls, valor: str) -> str:
        if not v.email_valido(valor):
            raise ValueError("Informe um e-mail válido.")
        return valor.lower()


class ItemEntrada(_Base):
    produto_nome: str = Field(default="", max_length=120)
    categoria: str = Field(default="", max_length=60)
    quantidade: float = Field(default=0, ge=0, le=1_000_000)
    valor_unitario: float = Field(default=0, ge=0, le=10_000_000)

    @property
    def valido(self) -> bool:
        """Mesma regra do frontend: só conta item com nome e quantidade > 0."""
        return bool(self.produto_nome) and self.quantidade > 0


class DebitoEntrada(_Base):
    cliente_id: int = Field(gt=0)
    valor_debito: float | None = Field(default=None, ge=0, le=100_000_000)
    criacao_debito: date | None = None
    vencimento_debito: date
    descricao_debito: str = Field(max_length=500)
    itens: list[ItemEntrada] = Field(default_factory=list, max_length=200)

    @field_validator("descricao_debito")
    @classmethod
    def _descricao(cls, valor: str) -> str:
        if not valor:
            raise ValueError("Descreva o débito.")
        return valor

    @model_validator(mode="after")
    def _datas(self):
        if self.criacao_debito and self.vencimento_debito < self.criacao_debito:
            raise ValueError("O vencimento não pode ser anterior à data de criação.")
        return self


class ItensEntrada(_Base):
    itens: list[ItemEntrada] = Field(default_factory=list, max_length=200)
